import { z } from 'zod';

export const createFeedingLogEntrySchema = z.object({
  note: z.string().optional(),
});

export type CreateFeedingLogEntryInput = z.infer<typeof createFeedingLogEntrySchema>;
