import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

/**
 * Which sightings `userId` may read: their own, plus any that is neither
 * hidden (reports crossed the threshold) nor reported by them.
 *
 * This is the rule for READS only. Edits, deletes, and photo changes stay
 * registrant-only and keep filtering on `{ id, userId }` directly.
 */
export function visibleSightingWhere(userId: string): Prisma.SightingWhereInput {
  return {
    OR: [{ userId }, { hiddenAt: null, reports: { none: { reporterId: userId } } }],
  };
}

/** The sighting if `userId` may see it, else null. Bare row, no relations. */
export function findVisibleSighting(userId: string, id: string) {
  return prisma.sighting.findFirst({ where: { AND: [{ id }, visibleSightingWhere(userId)] } });
}
