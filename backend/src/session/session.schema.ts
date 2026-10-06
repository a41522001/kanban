import { z } from 'zod';

const sessionBaseSchema = {
  userId: z.string().min(1),
  familyId: z.string().min(1),
  generation: z.coerce.number().int().positive(),
  familyCreatedAtMs: z.coerce.number().int().positive(),
  tokenIssuedAtMs: z.coerce.number().int().positive(),
};

const currentSessionSchema = z.object({
  ...sessionBaseSchema,
  state: z.literal('current'),
  rotateAtMs: z.coerce.number().int().positive(),
  expiresAtMs: z.coerce.number().int().positive(),
  previousSessionIdHash: z.string().min(1).optional(),
});

const graceSessionSchema = z.object({
  ...sessionBaseSchema,
  state: z.literal('grace'),
});

export const storedSessionSchema = z.discriminatedUnion('state', [
  currentSessionSchema,
  graceSessionSchema,
]);
