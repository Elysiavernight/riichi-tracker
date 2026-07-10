import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../src/context/auth-context";
import {
  getRoom,
  setReady,
  startRoom,
  ApiError,
  type Room,
  type RoomMember,
} from "../../src/api/client";
import { colors, radii, spacing } from "../../src/theme/colors";
import { GameDashboard } from "@/components/game/game-dashboard";
const POLL_INTERVAL_MS = 2500;

export default function RoomScreen() {
  const { roomId: roomIdParam } = useLocalSearchParams<{ roomId: string }>();
  const roomId = Number(roomIdParam);
  const { player } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingReady, setIsTogglingReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startedGameId, setStartedGameId] = useState<number | null>(null);
  
  const refresh = useCallback(async () => {
    try {
      const data = await getRoom(roomId);
      setRoom(data.room);
      setMembers(data.members);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setIsLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!player) return null;

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pinkPrimary} />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? "Room not found."}</Text>
      </View>
    );
  }
  if (room.status === "finished") {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Match Concluded</Text>
        <Text style={[styles.subtitle, { textAlign: "center", marginBottom: spacing.md }]}>
          This room has already finished its session.
        </Text>
        <Pressable 
          style={styles.button} 
          onPress={() => router.replace("/lobby")}
        >
          <Text style={styles.buttonText}>Return to Lobby</Text>
        </Pressable>
      </View>
    );
  }

  const self = members.find((m) => m.playerId === player.id);
  const isHost = members[0]?.playerId === player.id;
  const isFull = members.length === 4;
  const allReady = isFull && members.every((m) => m.isReady);
  const gameIsLive = room.status === "in_progress" || startedGameId !== null;
  const playerNamesMap: Record<number, string> = {};
  members.forEach((m) => {
    if (m.joinOrder !== undefined) {
      const seatNumber = m.joinOrder + 1;
      playerNamesMap[seatNumber] = m.name;
    }
  });
  async function handleToggleReady() {
    if (!self) return;
    setIsTogglingReady(true);
    try {
      await setReady(roomId, player!.id, !self.isReady);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setIsTogglingReady(false);
    }
  }

  async function handleStart() {
    setIsStarting(true);
    try {
      const result = await startRoom(roomId, player!.id);
      setStartedGameId(result.gameId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reach the server.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>room #{room.id}</Text>
      <Text style={styles.title}>{room.mode}</Text>

      {gameIsLive ? (
        <GameDashboard 
          roomId={roomId}
          mySeat={self?.joinOrder !== undefined ? self.joinOrder + 1 : 1} 
          myName={player.name} 
          playerNamesMap={playerNamesMap}
        />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Players ({members.length}/4)
            </Text>
            {members.map((m) => (
              <View key={m.playerId} style={styles.memberRow}>
                <Text style={styles.memberName}>
                  {m.name}
                  {m.playerId === player.id ? " (you)" : ""}
                  {m.joinOrder === 0 ? " · host" : ""}
                </Text>
                <View style={[styles.readyPill, m.isReady && styles.readyPillActive]}>
                  <Text
                    style={[
                      styles.readyPillText,
                      m.isReady && styles.readyPillTextActive,
                    ]}
                  >
                    {m.isReady ? "ready" : "waiting"}
                  </Text>
                </View>
              </View>
            ))}
            {!isFull && (
              <Text style={styles.subtitle}>
                Waiting for {4 - members.length} more player
                {4 - members.length === 1 ? "" : "s"} to join.
              </Text>
            )}
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              self?.isReady && styles.buttonSecondary,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleToggleReady}
            disabled={isTogglingReady}
          >
            {isTogglingReady ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>
                {self?.isReady ? "Cancel ready" : "Ready up"}
              </Text>
            )}
          </Pressable>

          {isHost && (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                !allReady && styles.buttonDisabled,
                pressed && allReady && styles.buttonPressed,
              ]}
              onPress={handleStart}
              disabled={!allReady || isStarting}
            >
              {isStarting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Start game</Text>
              )}
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  eyebrow: {
    color: colors.pinkMuted,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 3,
    fontSize: 11,
    textAlign: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.pinkPrimary,
    textAlign: "center",
    textTransform: "capitalize",
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  memberName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  readyPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  readyPillActive: {
    backgroundColor: colors.pinkAccent,
    borderColor: colors.pinkAccent,
  },
  readyPillText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  readyPillTextActive: {
    color: colors.white,
  },
  button: {
    backgroundColor: colors.pinkAccent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.pinkAccent,
  },
  buttonDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPressed: {
    backgroundColor: colors.pinkStrong,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  error: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
  },
});