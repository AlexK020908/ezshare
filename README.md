# ezshare

A small file drop on [DeepSpace](https://docs.deep.space): send files to yourself across devices, share folders with the people you choose, and ask questions about a folder's documents.

**Live:** https://ezshare.app.space

## What it does

- **My drop**: a private folder per account. Upload on one device and it shows up on your other devices without a refresh.
- **Shared folders**: invite people with an editor link (upload and download) or a viewer link (download only). Someone who opens a link while signed out is asked to sign in and then lands in the folder. The owner can remove people and reset links.
- **Ask this folder**: a question gets an answer drawn only from that folder's documents (PDF, Word, text, Markdown, CSV, JSON, code; up to 4 MB each), with numbered sources.

## How it's built

### Design source

The architecture follows Hello Interview's system-design breakdown ["Design a File Storage Service Like Dropbox"](https://www.hellointerview.com/learn/system-design/problem-breakdowns/dropbox) (Evan King). I used it as the blueprint and mapped each part onto DeepSpace primitives.

What I took from it:

| Article section | What it recommends | In ezshare |
|---|---|---|
| Functional requirements | Upload and download from any device, share files, sync across devices | "My drop" (every device, live) and shared folders. Sharing is per folder by invite link, not per file by email. |
| Out of scope (in the article too) | Editing, preview, storage quotas, versioning, virus scanning | None of these are built |
| Core entities | File, FileMetadata, User | Bytes in platform storage (R2); the `files` collection (name, size, type, uploader, plus folder and SHA-256 fingerprint); DeepSpace accounts |
| API guidance | Take the user from the session token, never from the client, and check access to the file | Every server action and the download route do exactly this |
| Upload | "Great": upload directly to blob storage | `useR2Files().upload` sends the bytes straight to storage; the `addFile` action then records the metadata after a role check |
| Sharing | "Great": a separate table for shares | The `team_members` collection plus DeepSpace's built-in `'team'` read rule |
| Sync (remote to local) | WebSocket push, with polling as a safety net | DeepSpace live queries (WebSocket, resent on reconnect) |
| Deep dive: large files | Client-side chunking, multipart upload, SHA-256 fingerprints | Multipart upload is automatic above 20 MiB; a SHA-256 fingerprint skips duplicate uploads to a folder |
| Deep dive: security | HTTPS, access control from the share table, short-lived signed URLs (which it warns are bearer tokens) | HTTPS; folder membership checked on every download; download links need the signed-in session, so a leaked link is useless to non-members |

Where ezshare differs or stops short:

- **Download.** The article's better options are signed URLs from blob storage or a CDN. DeepSpace storage has no signed URL for "a chosen group", so a small membership-checked route streams the bytes instead (see "The one custom access layer" below).
- **Left out:** the desktop sync agent that watches a local folder (ezshare is a web app), per-chunk resume, delta sync, content-defined chunking and compression. Files are capped at 10 MB because the free plan gives the whole app 128 MiB, so those optimizations would not pay off at this size.

### DeepSpace integrations used

| Integration | Why it's here |
|---|---|
| Auth (Google/GitHub sign-in) | One account across devices; identity for every permission check |
| Records + real-time sync | File lists, folders and members update live on every device and for every member |
| Permissions (RBAC `'team'` rule) | The server hides a folder's records from anyone not in its `team_members` |
| File storage (R2) | File bytes, in each uploader's private storage |
| Server actions | Every write, because each depends on the caller's role *inside a folder* |
| Presence | "Who's here now" in shared folders |
| Managed knowledge (AI Search) + AI (Claude) | "Ask this folder": per-folder search plus a cited answer |

Left out on purpose: messaging, canvas and co-editing (files aren't edited in the app), payments (it's free), video rooms, and scheduled jobs (nothing runs on a timer).

### The one custom access layer

DeepSpace file storage has two levels: private to the uploader, or public to anyone with the URL. Its docs say a file "shared with a chosen group but hidden from the public is not one of the built-in levels." So every file stays in its uploader's private storage. The download route verifies the caller (bearer token, or the same-origin session cookie so a plain link works), checks that they are an active member of the file's folder, and only then streams the bytes. Non-members get the same 404 as a missing file. Responses are always `attachment` + `application/octet-stream` + `nosniff`, so an uploaded HTML or SVG file can never run on the app's origin.

### Code map

- [src/schemas/drive-schemas.ts](src/schemas/drive-schemas.ts): data model and permissions (clients are read-only)
- [src/actions/index.ts](src/actions/index.ts): all writes; each starts with a folder-role check
- [src/server/drive-access.ts](src/server/drive-access.ts): the membership check
- [src/server/drive-routes.ts](src/server/drive-routes.ts): the download route
- [src/lib/drive.ts](src/lib/drive.ts): pure rules (roles, limits, naming, file-type labels), unit-tested in `drive.test.ts`
- [src/lib/pending-invite.ts](src/lib/pending-invite.ts): keeps an invite across sign-in (Google/GitHub sign-in returns to the app, not to the invite page)
- [src/components/drive/](src/components/drive/) and [src/pages/(app)/](src/pages/(app)/): UI (the invite page, `join/[token].tsx`, is outside `(protected)` so signed-out visitors see it)
- [tests/sharing.spec.ts](tests/sharing.spec.ts): owner / stranger / member end-to-end check, plus joining from an invite opened while signed out

## Limits

- 10 MB per file; the free plan gives the whole app 128 MiB.
- AI answers are paid from the app owner's DeepSpace credits, so each person gets 25 questions a day (counted server-side in `ask_usage`).
- New documents take about 2 minutes to index before "ask this folder" can use them.
- AI search takes documents up to 4 MB: DeepSpace's knowledge base accepts at most 4 MiB per part and refuses larger PDFs and Word files (it only splits plain-text formats itself). Larger documents are stored and shared normally and are labelled "Over 4 MB". Scanned PDFs (pages that are only images) may not be searchable.
- "Who's here now" uses DeepSpace presence rooms, which don't check folder membership. They are only joined in shared folders, whose ids are random and known only to members. Someone removed from a folder who kept its id could still see who is viewing it, but never its files.
- No version history, trash, previews, subfolders or desktop sync client.

## Run it

```bash
npm install
npx deepspace auth login
npx deepspace dev start      # uploads work locally only after the first deploy
npm run test:unit
npx deepspace test run all   # needs 3 test accounts for tests/sharing.spec.ts
npx deepspace deploy
```
