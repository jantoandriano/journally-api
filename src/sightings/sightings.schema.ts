import { z } from 'zod';

export const createSightingSchema = z.object({
  species: z.enum(['cat', 'dog']),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  notes: z.string().optional(),
  attributes: z.array(z.string().min(1)).default([]),
  // Address the client already resolved while the user placed the pin, so
  // map pins never need a reverse-geocode lookup of their own.
  placeName: z.string().trim().max(200).optional(),
});

export type CreateSightingInput = z.infer<typeof createSightingSchema>;

// No `fed` here: fed/fedAt are derived from the feeding log at read time.
// Zod strips unknown keys, so an old client's `PATCH { fed }` is ignored.
export const updateSightingSchema = createSightingSchema.partial();

export type UpdateSightingInput = z.infer<typeof updateSightingSchema>;

export const nearbySightingQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().default(5),
  species: z.enum(['cat', 'dog']).optional(),
});

export type NearbySightingQuery = z.infer<typeof nearbySightingQuerySchema>;

/**
 * Visible map area. Boxes crossing the antimeridian (west > east) are not
 * supported and are rejected like any other inverted box.
 */
export const mapSightingQuerySchema = z
  .object({
    south: z.coerce.number().min(-90).max(90),
    west: z.coerce.number().min(-180).max(180),
    north: z.coerce.number().min(-90).max(90),
    east: z.coerce.number().min(-180).max(180),
    species: z.enum(['cat', 'dog']).optional(),
    // Only 'false' is meaningful: "not fed yet today".
    fed: z.enum(['false']).optional(),
  })
  .refine((box) => box.south < box.north && box.west < box.east, {
    message: 'south must be less than north and west less than east',
  });

export type MapSightingQuery = z.infer<typeof mapSightingQuerySchema>;
