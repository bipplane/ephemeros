import { z } from "zod";

export const contextRequestSchema = z.object({
  requestId: z
    .string()
    .regex(/^[A-Za-z0-9._-]{3,80}$/)
    .optional(),
  resourceType: z.enum(["schema", "docs", "code"]),
  resourceId: z
    .string()
    .min(3)
    .max(200)
    .regex(/^[A-Za-z0-9._:/-]+$/)
    .refine((value) => !value.startsWith("/") && !value.split("/").some((part) => part === "" || part === ".."), {
      message: "resourceId must be a scoped resource id, not a filesystem path"
    }),
  purpose: z.string().min(10).max(500),
  maxBytes: z.number().int().positive().max(262144).optional()
});

export const cleanupRequestSchema = z.object({
  contextId: z
    .string()
    .regex(/^[A-Za-z0-9._-]{3,120}$/)
    .optional()
});

export const lambdaPayloadSchema = z.object({
  contextId: z
    .string()
    .regex(/^[A-Za-z0-9._-]{3,120}$/)
    .optional(),
  content: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});
