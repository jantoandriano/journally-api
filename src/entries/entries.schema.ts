import { z } from 'zod';

export const createEntrySchema = z.object({
  placeName: z.string().min(1),
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  visitedAt: z.coerce.date().optional(),
  orderItems: z.array(z.string().min(1)).default([]),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  placeId: z.string().min(1).optional(),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;

export const updateEntrySchema = createEntrySchema.partial();

export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
