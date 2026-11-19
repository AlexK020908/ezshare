/**
 * /home is where the scaffold's nav and auth redirects land; ezshare's home is the drive.
 */

import { Navigate } from 'react-router-dom'

export default function HomePage() {
  return <Navigate to="/drive" replace />
}
