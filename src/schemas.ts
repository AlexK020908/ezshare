/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import {
  askUsageSchema,
  filesSchema,
  foldersSchema,
  invitesSchema,
  teamMembersSchema,
} from './schemas/drive-schemas'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  foldersSchema,
  teamMembersSchema,
  filesSchema,
  invitesSchema,
  askUsageSchema,
]
