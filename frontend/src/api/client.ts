const API_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export interface Player {
  id: number;
  name: string;
}

export type RoomMode = "tonpuusen" | "hanchan";

export interface Room {
  id: number;
  mode: RoomMode;
  status: string;
}

export interface RoomMember {
  playerId: number;
  joinOrder: number;
  isReady: boolean;
  name: string;
}

async function request<T>(
  path: string,
  options: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method,
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : "Something went wrong";
    throw new ApiError(message, res.status);
  }

  return data as T;
}

function post<T>(path: string, body: unknown) {
  return request<T>(path, { method: "POST", body });
}

function get<T>(path: string) {
  return request<T>(path, { method: "GET" });
}

export function registerPlayer(name: string, pin: string) {
  return post<Player>("/players", { name, pin });
}

export function loginPlayer(name: string, pin: string) {
  return post<Player>("/players/login", { name, pin });
}

export function createRoom(playerId: number, mode: RoomMode) {
  return post<Room>("/rooms", { playerId, mode });
}

export function joinRoom(roomId: number, playerId: number) {
  return post<{ roomId: number; playerId: number; seat: number }>(
    `/rooms/${roomId}/join`,
    { playerId },
  );
}

export function setReady(roomId: number, playerId: number, ready: boolean) {
  return post<{ ok: boolean }>(`/rooms/${roomId}/ready`, { playerId, ready });
}

export function getRoom(roomId: number) {
  return get<{ room: Room; members: RoomMember[] }>(`/rooms/${roomId}`);
}

export function startRoom(roomId: number, playerId: number) {
  return post<{ gameId: number }>(`/rooms/${roomId}/start`, { playerId });
}