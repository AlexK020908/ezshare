/**
 * /join/:token — redeem an invite link.
 *
 * This page sits outside (protected) on purpose: a signed-out visitor sees
 * what the link is for and a "Sign in to join" button. Google/GitHub sign-in
 * returns to the app rather than to this page, so the token is remembered for
 * the tab first (lib/pending-invite) and the signed-in area brings the user
 * back here. Signed in, the joinFolder action adds the membership.
 */

import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { AuthOverlay, useAuth } from 'deepspace'
import { Loader2, Users } from 'lucide-react'
import { Button, useToast } from '@/components/ui'
import { callAction } from '../../../lib/api'
import { forgetPendingInvite, rememberInvite } from '../../../lib/pending-invite'

export default function JoinPage() {
  const { token = '' } = useParams()
  const { isSignedIn } = useAuth()
  return isSignedIn ? <JoinFolder token={token} /> : <SignInToJoin token={token} />
}

function SignInToJoin({ token }: { token: string }) {
  const [signingIn, setSigningIn] = useState(false)

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[0_1px_2px_rgba(15,18,23,0.04)]">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
          <Users className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-[-0.02em]">You're invited to a shared folder</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to join it. You'll go straight to the folder afterwards.
        </p>
        <Button
          className="mt-6 h-11 w-full rounded-[10px] font-semibold"
          onClick={() => {
            rememberInvite(token)
            setSigningIn(true)
          }}
        >
          Sign in to join
        </Button>
      </div>
      {signingIn && (
        <AuthOverlay
          onClose={() => setSigningIn(false)}
          title="Sign in to join the folder"
          description="You'll go straight to the shared folder."
        />
      )}
    </div>
  )
}

function JoinFolder({ token }: { token: string }) {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const started = useRef(false)
  const { success } = useToast()

  useEffect(() => {
    if (started.current) return // React strict mode runs effects twice in dev
    started.current = true
    forgetPendingInvite() // being redeemed now, so don't bring the user back here later
    callAction<{ folderId: string; role: string; alreadyMember: boolean }>('joinFolder', { token })
      .then((res) => {
        if (!res.alreadyMember) success('Joined folder', `You can now ${res.role === 'editor' ? 'upload and download' : 'download'} files.`)
        setFolderId(res.folderId)
      })
      .catch((err: Error) => setFailure(err.message))
  }, [token, success])

  if (folderId) return <Navigate to={`/f/${folderId}`} replace />
  if (failure) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold tracking-[-0.02em]">Can't join this folder</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{failure}</p>
        <Link
          to="/drive"
          className="mt-5 inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Go to your drop
        </Link>
      </div>
    )
  }
  return (
    <p className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin text-primary" aria-hidden /> Joining folder…
    </p>
  )
}
