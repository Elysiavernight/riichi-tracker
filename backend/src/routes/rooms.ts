import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "../database/client";
import {
  rooms,
  roomPlayers,
  games,
  gameState,
  players,
} from "../database/schema";
import { errorSchema, roomIdParamsSchema } from "../database/schemas/common";
import { broadcast } from "../ws/connections";
import { STARTING_SCORE } from "../constants";

const createRoomSchema = z.object({
  playerId: z.number(),
  mode: z.enum(["tonpuusen", "hanchan"]),
});

const roomResponseSchema = z.object({
  id: z.number(),
  mode: z.string(),
  status: z.string(),
});

const joinBodySchema = z.object({ playerId: z.number() });
const joinResponseSchema = z.object({
  roomId: z.number(),
  playerId: z.number(),
  seat: z.number(),
});

const readyBodySchema = z.object({ playerId: z.number(), ready: z.boolean() });

const startBodySchema = z.object({ playerId: z.number() });

export async function roomRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    "/rooms",
    {
      schema: {
        tags: ["rooms"],
        summary: "Create a new room and auto-join the creator as seat 1",
        body: createRoomSchema,
        response: { 201: roomResponseSchema },
      },
    },
    async (req, reply) => {
      const room = await db
        .insert(rooms)
        .values({ mode: req.body.mode })
        .returning()
        .get();
      await db.insert(roomPlayers).values({
        roomId: room.id,
        playerId: req.body.playerId,
        joinOrder: 0,
      });
      return reply.code(201).send(room);
    },
  );

  typedApp.post(
    "/rooms/:roomId/join",
    {
      schema: {
        tags: ["rooms"],
        summary: "Join an existing room",
        params: roomIdParamsSchema,
        body: joinBodySchema,
        response: { 200: joinResponseSchema, 400: errorSchema },
      },
    },
    async (req, reply) => {
      const { roomId } = req.params;
      const { playerId } = req.body;
      const room = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .get();

      if (!room) {
        return reply.code(400).send({ error: "Room not found" });
      }

      if (room.status === "finished") {
        return reply.code(400).send({ error: "Game has finished" });
      }
      const existing = await db
        .select()
        .from(roomPlayers)
        .where(eq(roomPlayers.roomId, roomId))
        .all();

      if (existing.length >= 4) {
        return reply.code(400).send({ error: "Room is full" });
      }
      if (existing.some((p) => p.playerId === playerId)) {
        return reply.code(400).send({ error: "Player already joined" });
      }

      const joinOrder = existing.length;
      await db.insert(roomPlayers).values({ roomId, playerId, joinOrder });
      return reply.send({ roomId, playerId, seat: joinOrder + 1 });
    },
  );

  typedApp.post(
    "/rooms/:roomId/ready",
    {
      schema: {
        tags: ["rooms"],
        summary: "Mark a player as ready/not ready in a room",
        params: roomIdParamsSchema,
        body: readyBodySchema,
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { roomId } = req.params;
      const { playerId, ready } = req.body;

      await db
        .update(roomPlayers)
        .set({ isReady: ready })
        .where(
          and(
            eq(roomPlayers.roomId, roomId),
            eq(roomPlayers.playerId, playerId),
          ),
        );

      return reply.send({ ok: true });
    },
  );

  typedApp.get(
    "/rooms/:roomId",
    {
      schema: {
        tags: ["rooms"],
        summary: "Get a room and its current members + final score standings",
        params: roomIdParamsSchema,
        response: {
          200: z.object({ room: z.any(), members: z.array(z.any()) }),
        },
      },
    },
    async (req, reply) => {
      const { roomId } = req.params;
      const room = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .get();

      const members = await db
        .select({
          playerId: roomPlayers.playerId,
          joinOrder: roomPlayers.joinOrder,
          isReady: roomPlayers.isReady,
          name: players.name,
        })
        .from(roomPlayers)
        .innerJoin(players, eq(players.id, roomPlayers.playerId))
        .where(eq(roomPlayers.roomId, roomId))
        .orderBy(roomPlayers.joinOrder)
        .all();

      const lastGame = await db
        .select()
        .from(games)
        .where(eq(games.roomId, roomId))
        .orderBy(games.id)
        .get();

      let currentScores: any = null;
      if (lastGame) {
        const state = await db
          .select()
          .from(gameState)
          .where(eq(gameState.gameId, lastGame.id))
          .get();
        if (state) {
          if (typeof state.currentScores === "string") {
            try {
              currentScores = JSON.parse(state.currentScores);
            } catch {
              currentScores = state.currentScores;
            }
          } else {
            currentScores = state.currentScores;
          }
        }
      }

      return reply.send({
        room: {
          ...room,
          currentScores,
        },
        members,
      });
    },
  );

  typedApp.post(
    "/rooms/:roomId/start",
    {
      schema: {
        tags: ["rooms"],
        summary: "Start a full, all-ready room (first joiner only)",
        params: roomIdParamsSchema,
        body: startBodySchema,
        response: {
          200: z.object({ gameId: z.number() }),
          400: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (req, reply) => {
      const { roomId } = req.params;
      const body = req.body;

      const room = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .get();
      if (!room) return reply.code(404).send({ error: "Room not found" });

      const members = await db
        .select()
        .from(roomPlayers)
        .where(eq(roomPlayers.roomId, roomId))
        .orderBy(roomPlayers.joinOrder)
        .all();

      if (members.length !== 4) {
        return reply.code(400).send({ error: "Room needs exactly 4 players" });
      }
      if (members[0].playerId !== body.playerId) {
        return reply
          .code(403)
          .send({ error: "Only the first joiner can start the game" });
      }
      if (!members.every((m) => m.isReady)) {
        return reply.code(400).send({ error: "Not all players are ready" });
      }

      const seatPlayers: Record<number, number> = {};
      const currentScores: Record<number, number> = {};
      members.forEach((m, i) => {
        const seat = i + 1;
        seatPlayers[seat] = m.playerId;
        currentScores[seat] = STARTING_SCORE;
      });

      const game = await db
        .insert(games)
        .values({ roomId, mode: room.mode })
        .returning()
        .get();

      await db.insert(gameState).values({
        gameId: game.id,
        roundWind: "east",
        roundNumber: 1,
        honba: 0,
        riichiPot: 0,
        dealerSeat: 1,
        seatPlayers,
        currentScores,
        riichiDeclared: [],
      });

      await db
        .update(rooms)
        .set({ status: "in_progress" })
        .where(eq(rooms.id, roomId));

      broadcast({ type: "GAME_STARTED", gameId: game.id });
      return reply.send({ gameId: game.id });
    },
  );
}
