import { z } from 'zod';

export const reportReasons = [
  'not_an_animal',
  'inappropriate',
  'private_info',
  'spam',
  'other',
] as const;

export const reportSightingSchema = z.object({
  reason: z.enum(reportReasons),
  note: z.string().trim().max(500).optional(),
});

export type ReportSightingInput = z.infer<typeof reportSightingSchema>;
