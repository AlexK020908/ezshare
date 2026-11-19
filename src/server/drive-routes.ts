/**
 * The one piece of access control DeepSpace does not provide: sharing a
 * private file with a chosen group.
 *
 * Platform file storage has two levels — private to the uploader (`self`) or
 * public to anyone with the URL (`app`) — and its docs state that "a file
 * shared with a chosen group but hidden from the public is not one of the
 * built-in levels". So every file stays in its uploader's private storage,
 * and this route serves it to other folder members after checking, on the
 * server, that the caller is an active member of the file's folder.
 */

import type { Hono } from 'hono'
import { AppFileError, appFiles, resolveSessionReadAuth } from 'deepspace/worker'
import type { AppContext } from '../../worker.js'
import { createActionTools } from './action-routes.js'
import { folderRole, getFile } from './drive-access.js'
import { resolveAuth } from './http-routes.js'

/** RFC 6266 header with an ASCII fallback and the exact UTF-8 name. */
function attachmentHeader(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export function registerDriveRoutes(app: Hono<AppContext>): void {
  app.get('/api/drive/files/:fileId/download', async (c) => {
    // Bearer for fetch(); the same-origin session cookie lets a plain
    // <a href> download work (resolveSessionReadAuth only accepts same-origin
    // GET/HEAD, so another site cannot trigger it with the user's cookie).
    const auth =
      (await resolveAuth(c.req.raw, c.env)) ?? (await resolveSessionReadAuth(c.req.raw, c.env))
    if (!auth) return c.json({ error: 'Sign in to download files' }, 401)

    const fileId = c.req.param('fileId')
    const tools = createActionTools(c.env, auth.userId, '')
    const file = await getFile(tools, fileId)
    // Non-members get the same 404 as a missing file: no probing for ids.
    if (!file || !(await folderRole(tools, file.data.folderId, auth.userId))) {
      return c.json({ error: 'File not found' }, 404)
    }

    let upstream: Response
    try {
      upstream = await appFiles(c.env, { scope: 'self', userId: file.data.uploaderId }).download(
        file.data.storageKey,
      )
    } catch (err) {
      if (err instanceof AppFileError && err.status === 404) {
        return c.json({ error: 'The file is missing from storage' }, 404)
      }
      throw err
    }

    console.info(`[download] file=${fileId} caller=${auth.userId}`)
    const headers = new Headers({
      // Always a download, never rendered: an uploaded .html or .svg must not
      // run as a page on this app's origin.
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': attachmentHeader(file.data.name),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    })
    const length = upstream.headers.get('Content-Length')
    if (length) headers.set('Content-Length', length)
    return new Response(upstream.body, { status: 200, headers })
  })
}
