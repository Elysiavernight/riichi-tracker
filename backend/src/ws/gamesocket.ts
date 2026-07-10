import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../database/client";
import { gameState, games, handResults } from "../database/schema";
import type { Mode } from "../logic/scoring";
import { addConnection, removeConnection, broadcast } from "./connections";
import { wsActionSchema } from "./schemas";
import { applyGameAction, type ActionContext } from "./gameactions";

async function getActiveGame() {
  const game = await db
    .select()
    .from(games)
    .where(eq(games.status, "in_progress"))
    .get();
  return game ?? null;
}

export async function gameSocketRoutes(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, (socket, _req) => {
    addConnection(socket);
    app.log.info("Player connected.");

    void syncStateToSocket(socket);

    socket.on("message", async (raw: string) => {
      try {
        await handleIncomingAction(app, raw);
      } catch (err) {
        app.log.error(err);
      }
    });

    socket.on("close", () => {
      removeConnection(socket);
      app.log.info("Player phone locked/disconnected.");
    });
  });
}

async function syncStateToSocket(socket: any) {
  const game = await getActiveGame();
  if (!game) return;

  const state = await db
    .select()
    .from(gameState)
    .where(eq(gameState.gameId, game.id))
    .get();
  if (state) socket.send(JSON.stringify({ type: "SYNC_STATE", state }));
}

async function handleIncomingAction(app: FastifyInstance, raw: string) {
  const game = await getActiveGame();
  if (!game) return;

  const parsed = wsActionSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    app.log.warn(parsed.error, "Invalid ws action payload");
    return;
  }

  const state = await db
    .select()
    .from(gameState)
    .where(eq(gameState.gameId, game.id))
    .get();
  if (!state) return;

  const ctx: ActionContext = {
    gameId: game.id,
    mode: game.mode as Mode,
    seatPlayers: state.seatPlayers as Record<number, number>,
    scores: { ...(state.currentScores as Record<number, number>) },
    riichiDeclared: [...(state.riichiDeclared as number[])],
    riichiPot: state.riichiPot,
    round: {
      roundWind: state.roundWind,
      roundNumber: state.roundNumber,
      honba: state.honba,
      dealerSeat: state.dealerSeat,
    },
    pendingRonClaims: state.pendingRonClaims as Record<
      number,
      { winnerSeat: number; han: number }[]
    >,
  };

  const result = applyGameAction(ctx, parsed.data);

  let gameEnded = result.gameEnded;
  let endReason: "normal" | "tobi" | null = null;
  if (!gameEnded && Object.values(result.scores).some((s) => s < 0)) {
    gameEnded = true;
    endReason = "tobi";
  } else if (gameEnded) {
    endReason = "normal";
  }

  db.transaction((tx) => {
    if (result.ledgerRow) tx.insert(handResults).values(result.ledgerRow).run();

    tx.update(gameState)
      .set({
        currentScores: result.scores,
        riichiDeclared: result.riichiDeclared,
        riichiPot: result.riichiPot,
        honba: result.round.honba,
        dealerSeat: result.round.dealerSeat,
        roundWind: result.round.roundWind,
        roundNumber: result.round.roundNumber,
        pendingRonClaims: result.pendingRonClaims,
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
      scores: result.scores,
      riichiDeclared: result.riichiDeclared,
      riichiPot: result.riichiPot,
      honba: result.round.honba,
      dealerSeat: result.round.dealerSeat,
      roundWind: result.round.roundWind,
      roundNumber: result.round.roundNumber,
      pendingRonClaims: result.pendingRonClaims,
    },
    endReason: gameEnded ? endReason : undefined,
  });
}