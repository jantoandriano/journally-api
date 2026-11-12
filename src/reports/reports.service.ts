import { prisma } from '../db';
import { findVisibleSighting } from '../sightings/visibility';
import type { ReportSightingInput } from './reports.schema';

const DEFAULT_HIDE_THRESHOLD = 3;

/**
 * Distinct reporters needed before a sighting is hidden from everyone but
 * its registrant. Read per call (not at module load) so it can be changed
 * without a restart and overridden in tests.
 */
function hideThreshold(): number {
  const configured = Number(process.env.REPORT_HIDE_THRESHOLD);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_HIDE_THRESHOLD;
}

export type ReportSightingResult = 'created' | 'already_reported' | 'not_found' | 'own_sighting';

/**
 * Files `userId`'s report against a sighting. A reported sighting stops
 * being visible to its reporter immediately (see visibleSightingWhere);
 * once enough distinct users report it, it is hidden from everyone except
 * its registrant, who is not told. There is no moderation UI: reports are
 * reviewed in the database, and un-hiding means clearing `hiddenAt` by hand.
 */
export async function reportSighting(
  userId: string,
  sightingId: string,
  input: ReportSightingInput
): Promise<ReportSightingResult> {
  // First: a repeat report. The caller's own earlier report already made the
  // sighting invisible to them, so this must come before the visibility check.
  const existing = await prisma.sightingReport.findUnique({
    where: { sightingId_reporterId: { sightingId, reporterId: userId } },
  });
  if (existing) return 'already_reported';

  const sighting = await findVisibleSighting(userId, sightingId);
  if (!sighting) return 'not_found';
  if (sighting.userId === userId) return 'own_sighting';

  await prisma.sightingReport.create({
    data: { sightingId, reporterId: userId, reason: input.reason, note: input.note || null },
  });

  const reporters = await prisma.sightingReport.count({ where: { sightingId } });
  if (reporters >= hideThreshold() && sighting.hiddenAt === null) {
    await prisma.sighting.update({ where: { id: sightingId }, data: { hiddenAt: new Date() } });
  }

  return 'created';
}
