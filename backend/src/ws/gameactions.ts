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

export interface ActionContext {
  gameId: number;
  mode: Mode;
  seatPlayers: Record<number, number>;
  scores: Record<number, number>;
  riichiDeclared: number[];
  riichiPot: number;
  round: RoundInfo;
}

export interface ActionResult {
  scores: Record<number, number>;
  riichiDeclared: number[];
  riichiPot: number;
  round: RoundInfo;
  ledgerRow: LedgerRow | null;
  gameEnded: boolean;
}

export function applyGameAction(
  ctx: ActionContext,
  action: WsAction,
): ActionResult {
  switch (action.action) {
    case "DECLARE_RIICHI":
      return applyRiichi(ctx, action.seat);
    case "DECLARE_RON":
      return applyRon(ctx, action.winnerSeats, action.loserSeat, action.han);
    case "DECLARE_TSUMO":
      return applyTsumo(ctx, action.winnerSeat, action.han);
    case "EXHAUSTIVE_DRAW":
      return applyExhaustiveDraw(ctx, action.tenpaiSeats);
  }
}

function applyRiichi(ctx: ActionContext, seat: number): ActionResult {
  const scores = { ...ctx.scores };
  const riichiDeclared = [...ctx.riichiDeclared];
  let riichiPot = ctx.riichiPot;
  let round = ctx.round;
  let ledgerRow: LedgerRow | null = null;
  let gameEnded = false;

  if (riichiDeclared.includes(seat) || scores[seat] < 1000) {
    return { scores, riichiDeclared, riichiPot, round, ledgerRow, gameEnded };
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
    return { scores, riichiDeclared: [], riichiPot, round, ledgerRow, gameEnded };
  }

  return { scores, riichiDeclared, riichiPot, round, ledgerRow, gameEnded };
}

function applyRon(
  ctx: ActionContext,
  winnerSeats: number[],
  loserSeat: number,
  han: number,
): ActionResult {
  const scores = { ...ctx.scores };
  const round = ctx.round;
  const scoreDeltas: Record<number, number> = {};
  let totalFromLoser = 0;
  const anyWinnerIsDealer = winnerSeats.includes(round.dealerSeat);

  winnerSeats.forEach((winnerSeat, i) => {
    const isDealer = winnerSeat === round.dealerSeat;
    const payout = getRonPayout(isDealer, han, round.honba);
    scores[winnerSeat] += payout;
    scoreDeltas[ctx.seatPlayers[winnerSeat]] = payout;
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
    han,
    winners: winnerSeats.map((s) => ctx.seatPlayers[s]),
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