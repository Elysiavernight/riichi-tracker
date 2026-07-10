import { useEffect, useState } from "react";
import { router, Redirect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../../src/context/auth-context";
import {
  createRoom,
  joinRoom,
  ApiError,
  getCurrentRoom,
  type RoomMode,
} from "../../src/api/client";
import { colors, radii, spacing } from "../../src/theme/colors";

export default function LobbyHome() {
  const { player, logout } = useAuth();
  const [mode, setMode] = useState<RoomMode>("hanchan");
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingRoom, setIsCheckingRoom] = useState(true)
  const [reconnectRoomId, setReconnectRoomId] = useState<number | null>(null);
  
  useEffect(()=>{
    async function checkActiveGame(){
      if(!player){
        setIsCheckingRoom(false)
        return
      }
      try{
      const data = await getCurrentRoom(player.id)
      console.log(`Server : `, data)
      if(data.roomId){
        console.log(`reconnecting to room ${data.roomId}`)
        setReconnectRoomId(data.roomId)
        setIsCheckingRoom(false)
        return
      }
    } catch(err){
      console.error("Failed to check active room", err)
    }
    setIsCheckingRoom(false)
    }
    checkActiveGame()
  }, [player])
  if (!player) {
    return <Redirect href="/auth/login" />; 
  }
  if (reconnectRoomId) {
    console.log(reconnectRoomId)
    return <Redirect href={`/lobby/${reconnectRoomId}`} />;
  }
  
  if(isCheckingRoom){
    return(
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.pinkPrimary} />
        <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>
          Checking for active tables...
        </Text>
      </View>
    )
  }

  const currentPlayer = player;

  async function handleCreate() {
    setError(null);
    setIsCreating(true);
    try {
      const room = await createRoom(currentPlayer.id, mode);
      router.push(`/lobby/${room.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't reach the server.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoin() {
    setError(null);
    const roomId = Number(joinCode.trim());
    if (!joinCode.trim() || Number.isNaN(roomId)) {
      setError("Enter a valid room ID.");
      return;
    }
    setIsJoining(true);
    try {
      await joinRoom(roomId, currentPlayer.id);
      router.push(`/lobby/${roomId}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't reach the server.",
      );
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Riichi Tracker</Text>
      <Text style={styles.title}>Hi, {currentPlayer.name}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create a room</Text>

        <View style={styles.modeRow}>
          {(["hanchan", "tonpuusen"] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[styles.modeButton, mode === m && styles.modeButtonActive]}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  mode === m && styles.modeButtonTextActive,
                ]}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleCreate}
          disabled={isCreating}
        >
          {isCreating ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Create room</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Join a room</Text>
        <TextInput
          style={styles.input}
          placeholder="Room ID"
          placeholderTextColor={colors.textMuted}
          value={joinCode}
          onChangeText={setJoinCode}
          keyboardType="number-pad"
        />
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleJoin}
          disabled={isJoining}
        >
          {isJoining ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Join room</Text>
          )}
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable onPress={logout} style={styles.logoutLink}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centered:{
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: spacing.xl * 2,
    backgroundColor: colors.background,
    gap: spacing.md,
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
  modeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  modeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  modeButtonActive: {
    backgroundColor: colors.pinkAccent,
    borderColor: colors.pinkAccent,
  },
  modeButtonText: {
    color: colors.textSecondary,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  modeButtonTextActive: {
    color: colors.white,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundDeep,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.pinkAccent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  buttonPressed: {
    backgroundColor: colors.pinkStrong,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  logoutLink: {
    alignItems: "center",
    marginTop: spacing.md,
  },
  logoutText: {
    color: colors.pinkMuted,
    fontWeight: "600",
  },
  error: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
  },
});
