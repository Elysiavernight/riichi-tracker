type HanRange = [minHan: number, maxHan: number, points: number];

const NON_DEALER_TABLE: HanRange[] = [
  [1, 1, 1_000],
  [2, 2, 2_000],
  [3, 3, 6_000],
  [4, 4, 7_000],
  [5, 5, 8_000],
  [6, 7, 12_000],
  [8, 10, 18_000],
  [11, 12, 24_000],
];

const DEALER_TABLE: HanRange[] = [
  [1, 1, 2_000],
  [2, 2, 3_000],
  [3, 3, 7_700],
  [4, 4, 11_600],
  [5, 5, 12_000],
  [6, 7, 18_000],
  [8, 10, 24_000],
  [11, 12, 36_000],
];

const YAKUMAN_BASE = { nonDealer: 32_000, dealer: 48_000 };
const HONBA_VALUE = 1_000;

export function getBasePoints(han: number, isDealer: boolean): number {
  if (!Number.isInteger(han) || han < 1) {
    throw new Error(`Invalid han value: ${han}`);
  }

  if (han >= 13) {
    const multiplier = Math.max(1, Math.floor(han / 13));
    return (
      (isDealer ? YAKUMAN_BASE.dealer : YAKUMAN_BASE.nonDealer) * multiplier
    );
  }

  const table = isDealer ? DEALER_TABLE : NON_DEALER_TABLE;
  for (const [min, max, points] of table) {
    if (han >= min && han <= max) return points;
  }

  throw new Error(`No scoring entry for han=${han}`);
}

export function applyHonba(basePoints: number, honba: number): number {
  return basePoints + honba * HONBA_VALUE;
}

export function getRonPayout(
  isWinnerDealer: boolean,
  han: number,
  honba: number,
): number {
  return applyHonba(getBasePoints(han, isWinnerDealer), honba);
}

export function splitRounded(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts / 100) * 100;
  const shares = new Array(parts).fill(base);
  let remainder = total - base * parts;
  let i = 0;
  while (remainder > 0 && i < parts) {
    shares[i] += 100;
    remainder -= 100;
    i++;
  }
  return shares;
}

export interface TsumoSplit {
  winnerGain: number;
  payments: Record<number, number>;
}

export function calculateTsumoSplits(
  winnerSeat: number,
  dealerSeat: number,
  seats: number[],
  han: number,
  honba: number,
): TsumoSplit {
  const isDealer = winnerSeat === dealerSeat;
  const total = applyHonba(getBasePoints(han, isDealer), honba);
  const payers = seats.filter((s) => s !== winnerSeat);
  const payments: Record<number, number> = {};

  if (isDealer) {
    const shares = splitRounded(total, payers.length);
    payers.forEach((seat, i) => (payments[seat] = shares[i]));
  } else {
    const nonDealerPayers = payers.filter((s) => s !== dealerSeat);
    const unit = total / (nonDealerPayers.length + 2);
    payments[dealerSeat] = unit * 2;
    nonDealerPayers.forEach((seat) => (payments[seat] = unit));
  }

  const winnerGain = Object.values(payments).reduce((a, b) => a + b, 0);
  return { winnerGain, payments };
}

const NOTEN_TOTAL = 3_000;

export function calculateNotenPayments(
  tenpaiSeats: number[],
  allSeats: number[],
): Record<number, number> {
  const deltas: Record<number, number> = {};
  allSeats.forEach((s) => (deltas[s] = 0));

  const notenSeats = allSeats.filter((s) => !tenpaiSeats.includes(s));
  if (tenpaiSeats.length === 0 || notenSeats.length === 0) {
    return deltas;
  }

  const gains = splitRounded(NOTEN_TOTAL, tenpaiSeats.length);
  const losses = splitRounded(NOTEN_TOTAL, notenSeats.length);
  tenpaiSeats.forEach((s, i) => (deltas[s] += gains[i]));
  notenSeats.forEach((s, i) => (deltas[s] -= losses[i]));

  return deltas;
}

export interface RoundState {
  roundWind: "east" | "south";
  roundNumber: number;
  dealerSeat: number;
  honba: number;
}

export type Mode = "tonpuusen" | "hanchan";

function rotateDealer(
  state: RoundState,
  mode: Mode,
): RoundState & { gameEnded: boolean } {
  const newDealerSeat = (state.dealerSeat % 4) + 1;
  let { roundWind, roundNumber } = state;
  roundNumber += 1;

  if (roundNumber > 4) {
    if (roundWind === "east") {
      if (mode === "tonpuusen") {
        return {
          roundWind,
          roundNumber: 4,
          dealerSeat: state.dealerSeat,
          honba: 0,
          gameEnded: true,
        };
      }
      roundWind = "south";
      roundNumber = 1;
    } else {
      return {
        roundWind,
        roundNumber: 4,
        dealerSeat: state.dealerSeat,
        honba: 0,
        gameEnded: true,
      };
    }
  }

  return {
    roundWind,
    roundNumber,
    dealerSeat: newDealerSeat,
    honba: 0,
    gameEnded: false,
  };
}

export function advanceAfterWin(
  state: RoundState,
  winnerIsDealer: boolean,
  mode: Mode,
): RoundState & { gameEnded: boolean } {
  if (winnerIsDealer) {
    return { ...state, honba: state.honba + 1, gameEnded: false };
  }
  return rotateDealer(state, mode);
}

export function advanceAfterDraw(
  state: RoundState,
  dealerWasTenpai: boolean,
  mode: Mode,
): RoundState & { gameEnded: boolean } {
  if (dealerWasTenpai) {
    return { ...state, honba: state.honba + 1, gameEnded: false };
  }
  return rotateDealer(state, mode);
}
