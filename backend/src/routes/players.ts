import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../database/client";
import { players, roomPlayers, rooms } from "../database/schema";
import { errorSchema } from "../database/schemas/common";

const registerSchema = z.object({
  name: z.string().min(1),
  pin: z.string().min(4),
});

const playerResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const loginSchema = z.object({
  name: z.string(),
  pin: z.string(),
});
const loginResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
});
const currentRoomParamsSchema = z.object({
  playerId: z.coerce.number(),
});
const currentRoomResponseSchema = z.object({
  roomId: z.number().nullable(),
  status: z.string().optional(),
});
export async function playerRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/players",
    {
      schema: {
        tags: ["players"],
        summary: "Register a new player",
        body: registerSchema,
        response: {
          201: playerResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { name, pin } = req.body;
      const hashed = await Bun.password.hash(pin, {
        algorithm: "bcrypt",
        cost: 10,
      });

      const player = await db
        .insert(players)
        .values({ name, pin: hashed })
        .returning()
        .get();

      return reply.code(201).send(player);
    },
  );
  typedApp.get(
    "/players/:playerId/current-room",
    {
      schema: {
        tags: ["players"],
        summary: "check if player already in a room",
        params: currentRoomParamsSchema,
        response: {
          200: currentRoomResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const { playerId } = req.params;
      const roomPlayer = await db
        .select()
        .from(roomPlayers)
        .where(eq(roomPlayers.playerId, playerId))
        .get();
      if (!roomPlayer) {
        return reply.send({ roomId: null });
      }
      const userRooms = await db
        .select()
        .from(roomPlayers)
        .where(eq(roomPlayers.playerId, playerId))
        .all();

      if (userRooms.length === 0) {
        return reply.send({ roomId: null });
      }
      for (const userRoom of userRooms) {
        const room = await db
          .select()
          .from(rooms)
          .where(eq(rooms.id, userRoom.roomId))
          .get();

        if (
          room &&
          (room.status === "waiting" || room.status === "in_progress")
        ) {
          return reply.send({ roomId: room.id, status: room.status });
        }
      }

      return reply.send({ roomId: null });
    },
  );
  typedApp.post(
    "/players/login",
    {
      schema: {
        tags: ["players"],
        summary: "Log in with name + pin",
        body: loginSchema,
        response: {
          200: loginResponseSchema,
          401: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const player = await db
        .select()
        .from(players)
        .where(eq(players.name, req.body.name))
        .get();
      if (!player || !(await Bun.password.verify(req.body.pin, player.pin))) {
        return reply.code(401).send({ error: "Invalid name or PIN" });
      }
      return reply.send({ id: player.id, name: player.name });
    },
  );
}
