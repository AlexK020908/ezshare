/**
 * /drive — opens the signed-in user's personal drop (creating it on first visit).
 */

import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { callAction } from '../../../lib/api'

export default function DrivePage() {
  const [folderId, setFolderId] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    callAction<{ folderId: string }>('ensurePersonalFolder')
      .then((res) => setFolderId(res.folderId))
      .catch((err: Error) => setFailure(err.message))
  }, [])

  if (folderId) return <Navigate to={`/f/${folderId}`} replace />
  return (
    <p className="p-6 text-sm text-muted-foreground">{failure ? `Could not open your drop: ${failure}` : 'Opening your drop…'}</p>
  )
}
