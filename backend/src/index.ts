import Fastify from "fastify";
import websocket from "@fastify/websocket";
import cors from "@fastify/cors";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "./database/client";
import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"
import { 
  jsonSchemaTransform, 
  serializerCompiler, 
  validatorCompiler,
  type ZodTypeProvider 
} from "fastify-type-provider-zod";
import {
  players,
  rooms,
  roomPlayers,
  games,
  gameState,
  handResults,
} from "./database/schema";
import {
  getRonPayout,
  calculateTsumoSplits,
  calculateNotenPayments,
  advanceAfterWin,
  advanceAfterDraw,
  type Mode,
} from "./logic/scoring";

const fastify = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

// Zod becomes the validator/serializer for every route below, and also
// feeds the OpenAPI schema generation via jsonSchemaTransform.
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

await fastify.register(cors, { origin: "*" });
await fastify.register(websocket);

await fastify.register(swagger, {
  openapi: {
    info: {
      title: "Riichi Mahjong Score Tracker API",
      description: "REST + WebSocket API for managing players, rooms and live game scoring",
      version: "1.0.0",
    },
    servers: [{ url: "http://localhost:3000", description: "Local dev server" }],
    tags: [
      { name: "players", description: "Player registration and login" },
      { name: "rooms", description: "Room lifecycle: create, join, ready up, start" },
    ],
  },
  transform: jsonSchemaTransform,
});

await fastify.register(swaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    docExpansion: "list",
    deepLinking: true,
  },
});

const STARTING_SCORE = 25_000;

const activeConnections = new Set<any>();
function broadcast(message: object) {
  const payload = JSON.stringify(message);
  for (const socket of activeConnections) {
    if (socket.readyState === 1) socket.send(payload);
  }
}

async function getActiveGame() {
  const game = await db
    .select()
    .from(games)
    .where(eq(games.status, "in_progress"))
    .get();
  return game ?? null;
}

const registerSchema = z.object({
  name: z.string().min(1),
  pin: z.string().min(4),
});

const playerResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  pin: z.string(),
});

const errorSchema = z.object({ error: z.string() });

fastify.post(
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
    // req.body is now typed + validated as z.infer<typeof registerSchema>
    const player = await db.insert(players).values(req.body).returning().get();
    return reply.code(201).send(player);
  },
);

const loginSchema = z.object({ name: z.string(), pin: z.string() });
const loginResponseSchema = z.object({ id: z.number(), name: z.string() });

fastify.post(
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
    if (!player || player.pin !== req.body.pin) {
      return reply.code(401).send({ error: "Invalid name or PIN" });
    }
    return reply.send({ id: player.id, name: player.name });
  },
);

const createRoomSchema = z.object({
  playerId: z.number(),
  mode: z.enum(["tonpuusen", "hanchan"]),
});

const roomResponseSchema = z.object({
  id: z.number(),
  mode: z.string(),
  status: z.string(),
});

fastify.post(
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
    await db
      .insert(roomPlayers)
      .values({ roomId: room.id, playerId: req.body.playerId, joinOrder: 0 });
    return reply.code(201).send(room);
  },
);

const roomIdParamsSchema = z.object({ roomId: z.coerce.number() });
const joinBodySchema = z.object({ playerId: z.number() });
const joinResponseSchema = z.object({
  roomId: z.number(),
  playerId: z.number(),
  seat: z.number(),
});

fastify.post(
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

const readyBodySchema = z.object({ playerId: z.number(), ready: z.boolean() });

fastify.post(
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
        and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.playerId, playerId)),
      );

    return reply.send({ ok: true });
  },
);

fastify.get(
  "/rooms/:roomId",
  {
    schema: {
      tags: ["rooms"],
      summary: "Get a room and its current members",
      params: roomIdParamsSchema,
      // Loosely typed response: room/members shapes come straight from
      // drizzle's inferred row types rather than a hand-written zod schema.
      response: {
        200: z.object({ room: z.any(), members: z.array(z.any()) }),
      },
    },
  },
  async (req, reply) => {
    const { roomId } = req.params;
    const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).get();
    const members = await db
      .select()
      .from(roomPlayers)
      .where(eq(roomPlayers.roomId, roomId))
      .all();
    return reply.send({ room, members });
  },
);

const startBodySchema = z.object({ playerId: z.number() });

fastify.post(
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

  const room = await db.select().from(rooms).where(eq(rooms.id, roomId)).get();
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

const wsActionSchema = z.discriminatedUnion("action", [
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

const ALL_SEATS = [1, 2, 3, 4];

fastify.register(async function (fastify) {
  fastify.get("/ws", { websocket: true }, (socket, _req) => {
    activeConnections.add(socket);
    fastify.log.info("Player connected.");

    (async () => {
      const game = await getActiveGame();
      if (game) {
        const state = await db
          .select()
          .from(gameState)
          .where(eq(gameState.gameId, game.id))
          .get();
        if (state) socket.send(JSON.stringify({ type: "SYNC_STATE", state }));
      }
    })();

    socket.on("message", async (raw: string) => {
      try {
        const game = await getActiveGame();
        if (!game) return;

        const parsed = wsActionSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          fastify.log.warn(parsed.error, "Invalid ws action payload");
          return;
        }
        const data = parsed.data;
        const mode = game.mode as Mode;

        const state = await db
          .select()
          .from(gameState)
          .where(eq(gameState.gameId, game.id))
          .get();
        if (!state) return;

        let scores = { ...(state.currentScores as Record<number, number>) };
        let riichiDeclared = [...(state.riichiDeclared as number[])];
        const seatPlayers = state.seatPlayers as Record<number, number>;
        let { roundWind, roundNumber, honba, riichiPot, dealerSeat } = state;

        let ledgerRow: typeof handResults.$inferInsert | null = null;
        let gameEnded = false;
        let endReason: "normal" | "tobi" | null = null;

        switch (data.action) {
          case "DECLARE_RIICHI": {
            const { seat } = data;
            if (riichiDeclared.includes(seat) || scores[seat] < 1000) break;

            scores[seat] -= 1000;
            riichiPot += 1;
            riichiDeclared.push(seat);

            if (riichiDeclared.length === 4) {
              const advanced = advanceAfterWin(
                { roundWind, roundNumber, dealerSeat, honba },
                true,
                mode,
              );
              roundWind = advanced.roundWind;
              roundNumber = advanced.roundNumber;
              dealerSeat = advanced.dealerSeat;
              honba = advanced.honba;
              gameEnded = advanced.gameEnded;

              ledgerRow = {
                gameId: game.id,
                roundWind: state.roundWind,
                roundNumber: state.roundNumber,
                honba: state.honba,
                resultType: "four_riichi_abort",
                scoreDeltas: Object.fromEntries(
                  riichiDeclared.map((s) => [seatPlayers[s], -1000]),
                ),
                riichiSticksAwarded: 0,
              };
              riichiDeclared = [];
            }
            break;
          }

          case "DECLARE_RON": {
            const { winnerSeats, loserSeat, han } = data;
            const scoreDeltas: Record<number, number> = {};
            let totalFromLoser = 0;
            const anyWinnerIsDealer = winnerSeats.includes(dealerSeat);

            winnerSeats.forEach((winnerSeat, i) => {
              const isDealer = winnerSeat === dealerSeat;
              const payout = getRonPayout(isDealer, han, honba);
              scores[winnerSeat] += payout;
              scoreDeltas[seatPlayers[winnerSeat]] = payout;
              totalFromLoser += payout;
              if (i === 0) {
                scores[winnerSeat] += riichiPot * 1000;
                scoreDeltas[seatPlayers[winnerSeat]] += riichiPot * 1000;
              }
            });

            scores[loserSeat] -= totalFromLoser;
            scoreDeltas[seatPlayers[loserSeat]] = -totalFromLoser;

            const sticksAwarded = riichiPot;
            riichiPot = 0;
            riichiDeclared = [];

            const advanced = advanceAfterWin(
              { roundWind, roundNumber, dealerSeat, honba },
              anyWinnerIsDealer,
              mode,
            );
            roundWind = advanced.roundWind;
            roundNumber = advanced.roundNumber;
            dealerSeat = advanced.dealerSeat;
            honba = advanced.honba;
            gameEnded = advanced.gameEnded;

            ledgerRow = {
              gameId: game.id,
              roundWind: state.roundWind,
              roundNumber: state.roundNumber,
              honba: state.honba,
              resultType: "ron",
              han,
              winners: winnerSeats.map((s) => seatPlayers[s]),
              loserPlayerId: seatPlayers[loserSeat],
              scoreDeltas,
              riichiSticksAwarded: sticksAwarded,
            };
            break;
          }

          case "DECLARE_TSUMO": {
            const { winnerSeat, han } = data;
            const isDealer = winnerSeat === dealerSeat;
            const { winnerGain, payments } = calculateTsumoSplits(
              winnerSeat,
              dealerSeat,
              ALL_SEATS,
              han,
              honba,
            );

            const scoreDeltas: Record<number, number> = {};
            for (const [seatStr, amount] of Object.entries(payments)) {
              const seat = Number(seatStr);
              scores[seat] -= amount;
              scoreDeltas[seatPlayers[seat]] = -amount;
            }
            const totalGain = winnerGain + riichiPot * 1000;
            scores[winnerSeat] += totalGain;
            scoreDeltas[seatPlayers[winnerSeat]] = totalGain;

            const sticksAwarded = riichiPot;
            riichiPot = 0;
            riichiDeclared = [];

            const advanced = advanceAfterWin(
              { roundWind, roundNumber, dealerSeat, honba },
              isDealer,
              mode,
            );
            roundWind = advanced.roundWind;
            roundNumber = advanced.roundNumber;
            dealerSeat = advanced.dealerSeat;
            honba = advanced.honba;
            gameEnded = advanced.gameEnded;

            ledgerRow = {
              gameId: game.id,
              roundWind: state.roundWind,
              roundNumber: state.roundNumber,
              honba: state.honba,
              resultType: "tsumo",
              han,
              winners: [seatPlayers[winnerSeat]],
              scoreDeltas,
              riichiSticksAwarded: sticksAwarded,
            };
            break;
          }

          case "EXHAUSTIVE_DRAW": {
            const { tenpaiSeats } = data;
            const deltas = calculateNotenPayments(tenpaiSeats, ALL_SEATS);
            const scoreDeltas: Record<number, number> = {};
            for (const [seatStr, delta] of Object.entries(deltas)) {
              const seat = Number(seatStr);
              scores[seat] += delta;
              scoreDeltas[seatPlayers[seat]] = delta;
            }

            const dealerWasTenpai = tenpaiSeats.includes(dealerSeat);
            riichiDeclared = [];

            const advanced = advanceAfterDraw(
              { roundWind, roundNumber, dealerSeat, honba },
              dealerWasTenpai,
              mode,
            );
            roundWind = advanced.roundWind;
            roundNumber = advanced.roundNumber;
            dealerSeat = advanced.dealerSeat;
            honba = advanced.honba;
            gameEnded = advanced.gameEnded;

            ledgerRow = {
              gameId: game.id,
              roundWind: state.roundWind,
              roundNumber: state.roundNumber,
              honba: state.honba,
              resultType: "draw",
              tenpaiPlayers: tenpaiSeats.map((s) => seatPlayers[s]),
              scoreDeltas,
              riichiSticksAwarded: 0,
            };
            break;
          }
        }

        if (!gameEnded && Object.values(scores).some((s) => s < 0)) {
          gameEnded = true;
          endReason = "tobi";
        } else if (gameEnded) {
          endReason = "normal";
        }

        db.transaction((tx) => {
          if (ledgerRow) tx.insert(handResults).values(ledgerRow).run();

          tx.update(gameState)
            .set({
              currentScores: scores,
              riichiDeclared,
              honba,
              riichiPot,
              dealerSeat,
              roundWind,
              roundNumber,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(gameState.gameId, game.id))
            .run();

          if (gameEnded) {
            tx.update(games)
              .set({
                status: "finished",
                endReason,
                endedAt: new Date().toISOString(),
              })
              .where(eq(games.id, game.id))
              .run();
          }
        });

        broadcast({
          type: gameEnded ? "GAME_OVER" : "STATE_UPDATE",
          state: {
            scores,
            riichiDeclared,
            honba,
            riichiPot,
            dealerSeat,
            roundWind,
            roundNumber,
          },
          endReason: gameEnded ? endReason : undefined,
        });
      } catch (err) {
        fastify.log.error(err);
      }
    });

    socket.on("close", () => {
      activeConnections.delete(socket);
      fastify.log.info("Player phone locked/disconnected.");
    });
  });
});

fastify.listen({ port: 7000, host: "0.0.0.0" }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`server listening on port 7000`);
});