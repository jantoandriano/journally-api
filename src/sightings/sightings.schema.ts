import { z } from 'zod';

export const createSightingSchema = z.object({
  species: z.enum(['cat', 'dog']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().optional(),
});

export type CreateSightingInput = z.infer<typeof createSightingSchema>;

export const updateSightingSchema = createSightingSchema.partial().extend({
  fed: z.boolean().optional(),
});

export type UpdateSightingInput = z.infer<typeof updateSightingSchema>;
