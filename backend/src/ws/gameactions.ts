import type { handResults } from "../database/schema";
import {
  getRonPayout,
  calculateTsumoSplits,
  calculateNotenPayments,
  advanceAfterWin,
  advanceAfterDraw,
  type Mode,
} from "../logic/scoring";
import { ALL_SEATS } from "../constants";
import type { WsAction } from "./schemas";

type LedgerRow = typeof handResults.$inferInsert;

/** The subset of round state that advanceAfterWin/advanceAfterDraw operate on. */
export interface RoundInfo {
  roundWind: "east"|"south";
  roundNumber: number;
  honba: number;
  dealerSeat: number;
}

/** A single winner's claim against a loser, awaiting the loser's confirmation. */
export interface RonClaim {
  winnerSeat: number;
  han: number;
}

export interface ActionContext {
  gameId: number;
  mode: Mode;
  seatPlayers: Record<number, number>;
  scores: Record<number, number>;
  riichiDeclared: number[];
  riichiPot: number;
  round: RoundInfo;
  /** Ron claims awaiting confirmation, keyed by the loser's (dealt-in) seat. */
  pendingRonClaims: Record<number, RonClaim[]>;
}

export interface ActionResult {
  scores: Record<number, number>;
  riichiDeclared: number[];
  riichiPot: number;
  round: RoundInfo;
  ledgerRow: LedgerRow | null;
  gameEnded: boolean;
  pendingRonClaims: Record<number, RonClaim[]>;
}

export function applyGameAction(
  ctx: ActionContext,
  action: WsAction,
): ActionResult {
  switch (action.action) {
    case "DECLARE_RIICHI":
      return applyRiichi(ctx, action.seat);
    case "CLAIM_RON":
      return applyClaimRon(ctx, action.winnerSeat, action.loserSeat, action.han);
    case "CANCEL_RON_CLAIM":
      return applyCancelRonClaim(ctx, action.winnerSeat, action.loserSeat);
    case "DECLINE_RON_CLAIMS":
      return applyDeclineRonClaims(ctx, action.loserSeat);
    case "CONFIRM_RON":
      return applyConfirmedRon(ctx, action.loserSeat);
    case "DECLARE_TSUMO":
      return applyTsumo(ctx, action.winnerSeat, action.han);
    case "EXHAUSTIVE_DRAW":
      return applyExhaustiveDraw(ctx, action.tenpaiSeats);
  }
}

function passthrough(ctx: ActionContext): ActionResult {
  return {
    scores: ctx.scores,
    riichiDeclared: ctx.riichiDeclared,
    riichiPot: ctx.riichiPot,
    round: ctx.round,
    ledgerRow: null,
    gameEnded: false,
    pendingRonClaims: ctx.pendingRonClaims,
  };
}

function applyRiichi(ctx: ActionContext, seat: number): ActionResult {
  const scores = { ...ctx.scores };
  const riichiDeclared = [...ctx.riichiDeclared];
  let riichiPot = ctx.riichiPot;
  let round = ctx.round;
  let ledgerRow: LedgerRow | null = null;
  let gameEnded = false;

  if (riichiDeclared.includes(seat) || scores[seat] < 1000) {
    return { ...passthrough(ctx), scores, riichiDeclared, riichiPot, round };
  }

  scores[seat] -= 1000;
  riichiPot += 1;
  riichiDeclared.push(seat);

  if (riichiDeclared.length === 4) {
    const advanced = advanceAfterWin(round, true, ctx.mode);

    ledgerRow = {
      gameId: ctx.gameId,
      roundWind: round.roundWind,
      roundNumber: round.roundNumber,
      honba: round.honba,
      resultType: "four_riichi_abort",
      scoreDeltas: Object.fromEntries(
        riichiDeclared.map((s) => [ctx.seatPlayers[s], -1000]),
      ),
      riichiSticksAwarded: 0,
    };

    round = toRoundInfo(advanced);
    gameEnded = advanced.gameEnded;
    return {
      scores,
      riichiDeclared: [],
      riichiPot,
      round,
      ledgerRow,
      gameEnded,
      // The hand is over — any stray claims against anyone are moot.
      pendingRonClaims: {},
    };
  }

  return { scores, riichiDeclared, riichiPot, round, ledgerRow, gameEnded, pendingRonClaims: ctx.pendingRonClaims };
}

/** A winner registers (or updates) their own claim against whoever dealt in. Nothing is scored yet. */
function applyClaimRon(
  ctx: ActionContext,
  winnerSeat: number,
  loserSeat: number,
  han: number,
): ActionResult {
  if (winnerSeat === loserSeat) {
    // Can't deal into yourself — ignore malformed claim.
    return passthrough(ctx);
  }

  const pendingRonClaims = { ...ctx.pendingRonClaims };
  const existing = pendingRonClaims[loserSeat] ?? [];
  // Replace any earlier claim from this winner (e.g. they fixed their han).
  pendingRonClaims[loserSeat] = [
    ...existing.filter((c) => c.winnerSeat !== winnerSeat),
    { winnerSeat, han },
  ];

  return { ...passthrough(ctx), pendingRonClaims };
}

/** A winner retracts their own claim before the loser confirms. */
function applyCancelRonClaim(
  ctx: ActionContext,
  winnerSeat: number,
  loserSeat: number,
): ActionResult {
  const pendingRonClaims = { ...ctx.pendingRonClaims };
  const existing = pendingRonClaims[loserSeat] ?? [];
  const filtered = existing.filter((c) => c.winnerSeat !== winnerSeat);

  if (filtered.length > 0) {
    pendingRonClaims[loserSeat] = filtered;
  } else {
    delete pendingRonClaims[loserSeat];
  }

  return { ...passthrough(ctx), pendingRonClaims };
}

/** The loser rejects everything claimed against them without paying anything. */
function applyDeclineRonClaims(ctx: ActionContext, loserSeat: number): ActionResult {
  const pendingRonClaims = { ...ctx.pendingRonClaims };
  delete pendingRonClaims[loserSeat];
  return { ...passthrough(ctx), pendingRonClaims };
}

/**
 * The loser confirms every pending claim against them. This is the only path
 * that actually moves points for a ron — a winner claiming can never move
 * points on their own, which is what prevents a winner from sabotaging the
 * loser's total.
 */
function applyConfirmedRon(ctx: ActionContext, loserSeat: number): ActionResult {
  const claims = ctx.pendingRonClaims[loserSeat] ?? [];
  if (claims.length === 0) {
    return passthrough(ctx);
  }

  const scores = { ...ctx.scores };
  const round = ctx.round;
  const scoreDeltas: Record<number, number> = {};
  const winnerHans: Record<number, number> = {};
  let totalFromLoser = 0;
  const anyWinnerIsDealer = claims.some((c) => c.winnerSeat === round.dealerSeat);

  claims.forEach(({ winnerSeat, han }, i) => {
    const isDealer = winnerSeat === round.dealerSeat;
    const payout = getRonPayout(isDealer, han, round.honba);
    scores[winnerSeat] += payout;
    scoreDeltas[ctx.seatPlayers[winnerSeat]] = payout;
    winnerHans[ctx.seatPlayers[winnerSeat]] = han;
    totalFromLoser += payout;
    if (i === 0) {
      scores[winnerSeat] += ctx.riichiPot * 1000;
      scoreDeltas[ctx.seatPlayers[winnerSeat]] += ctx.riichiPot * 1000;
    }
  });

  scores[loserSeat] -= totalFromLoser;
  scoreDeltas[ctx.seatPlayers[loserSeat]] = -totalFromLoser;

  const sticksAwarded = ctx.riichiPot;
  const advanced = advanceAfterWin(round, anyWinnerIsDealer, ctx.mode);

  const ledgerRow: LedgerRow = {
    gameId: ctx.gameId,
    roundWind: round.roundWind,
    roundNumber: round.roundNumber,
    honba: round.honba,
    resultType: "ron",
    han: claims[0].han,
    winnerHans,
    winners: claims.map((c) => ctx.seatPlayers[c.winnerSeat]),
    loserPlayerId: ctx.seatPlayers[loserSeat],
    scoreDeltas,
    riichiSticksAwarded: sticksAwarded,
  };

  return {
    scores,
    riichiDeclared: [],
    riichiPot: 0,
    round: toRoundInfo(advanced),
    ledgerRow,
    gameEnded: advanced.gameEnded,
    // The hand is over — clear every pending claim, not just this loser's.
    pendingRonClaims: {},
  };
}

function applyTsumo(
  ctx: ActionContext,
  winnerSeat: number,
  han: number,
): ActionResult {
  const scores = { ...ctx.scores };
  const round = ctx.round;
  const isDealer = winnerSeat === round.dealerSeat;
  const { winnerGain, payments } = calculateTsumoSplits(
    winnerSeat,
    round.dealerSeat,
    ALL_SEATS,
    han,
    round.honba,
  );

  const scoreDeltas: Record<number, number> = {};
  for (const [seatStr, amount] of Object.entries(payments)) {
    const seat = Number(seatStr);
    scores[seat] -= amount;
    scoreDeltas[ctx.seatPlayers[seat]] = -amount;
  }
  const totalGain = winnerGain + ctx.riichiPot * 1000;
  scores[winnerSeat] += totalGain;
  scoreDeltas[ctx.seatPlayers[winnerSeat]] = totalGain;

  const sticksAwarded = ctx.riichiPot;
  const advanced = advanceAfterWin(round, isDealer, ctx.mode);

  const ledgerRow: LedgerRow = {
    gameId: ctx.gameId,
    roundWind: round.roundWind,
    roundNumber: round.roundNumber,
    honba: round.honba,
    resultType: "tsumo",
    han,
    winners: [ctx.seatPlayers[winnerSeat]],
    scoreDeltas,
    riichiSticksAwarded: sticksAwarded,
  };

  return {
    scores,
    riichiDeclared: [],
    riichiPot: 0,
    round: toRoundInfo(advanced),
    ledgerRow,
    gameEnded: advanced.gameEnded,
    pendingRonClaims: {},
  };
}

function applyExhaustiveDraw(
  ctx: ActionContext,
  tenpaiSeats: number[],
): ActionResult {
  const scores = { ...ctx.scores };
  const round = ctx.round;
  const deltas = calculateNotenPayments(tenpaiSeats, ALL_SEATS);
  const scoreDeltas: Record<number, number> = {};
  for (const [seatStr, delta] of Object.entries(deltas)) {
    const seat = Number(seatStr);
    scores[seat] += delta;
    scoreDeltas[ctx.seatPlayers[seat]] = delta;
  }

  const dealerWasTenpai = tenpaiSeats.includes(round.dealerSeat);
  const advanced = advanceAfterDraw(round, dealerWasTenpai, ctx.mode);

  const ledgerRow: LedgerRow = {
    gameId: ctx.gameId,
    roundWind: round.roundWind,
    roundNumber: round.roundNumber,
    honba: round.honba,
    resultType: "draw",
    tenpaiPlayers: tenpaiSeats.map((s) => ctx.seatPlayers[s]),
    scoreDeltas,
    riichiSticksAwarded: 0,
  };

  return {
    scores,
    riichiDeclared: [],
    riichiPot: ctx.riichiPot,
    round: toRoundInfo(advanced),
    ledgerRow,
    gameEnded: advanced.gameEnded,
    pendingRonClaims: {},
  };
}

function toRoundInfo(advanced: {
  roundWind: "east"|"south";
  roundNumber: number;
  honba: number;
  dealerSeat: number;
}): RoundInfo {
  return {
    roundWind: advanced.roundWind,
    roundNumber: advanced.roundNumber,
    honba: advanced.honba,
    dealerSeat: advanced.dealerSeat,
  };
}