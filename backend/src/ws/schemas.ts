import { z } from "zod";

export const wsActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("DECLARE_RIICHI"),
    seat: z.number().min(1).max(4),
  }),

  z.object({
    action: z.literal("CLAIM_RON"),
    winnerSeat: z.number().min(1).max(4),
    loserSeat: z.number().min(1).max(4),
    han: z.number().int().min(1),
  }),

  z.object({
    action: z.literal("CANCEL_RON_CLAIM"),
    winnerSeat: z.number().min(1).max(4),
    loserSeat: z.number().min(1).max(4),
  }),
 
  z.object({
    action: z.literal("DECLINE_RON_CLAIMS"),
    loserSeat: z.number().min(1).max(4),
  }),
 
  z.object({
    action: z.literal("CONFIRM_RON"),
    loserSeat: z.number().min(1).max(4),
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