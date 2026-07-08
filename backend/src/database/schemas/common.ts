import { z } from "zod";

export const errorSchema = z.object({ error: z.string() });
export const roomIdParamsSchema = z.object({ roomId: z.coerce.number() });