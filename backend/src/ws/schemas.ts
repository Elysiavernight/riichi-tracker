import { z } from "zod";

export const wsActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("DECLARE_RIICHI"),
    seat: z.number().min(1).max(4),
  }),
  z.object({
    action: z.literal("DECLARE_RON"),
    winnerSeats: z.array(z.number().min(1).max(4)).min(1),
    loserSeat: z.number().min(1).max(4),
    han: z.number().int().min(1),
  }),
  z.object({
    action: z.literal("DECLARE_TSUMO"),
    winnerSeat: z.number().min(1).max(4),
    han: z.number().int().min(1),
  }),
  z.object({
    action: z.literal("EXHAUSTIVE_DRAW"),
    tenpaiSeats: z.array(z.number().min(1).max(4)),
  }),
]);

export type WsAction = z.infer<typeof wsActionSchema>;