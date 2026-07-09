import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { colors, radii, spacing } from "../../theme/colors";
import { useGameSocket } from "../../hooks/use-game-socket";

interface GameDashboardProps {
  mySeat: number; // Pass the local player's seat number (1-4) in here!
  myName: string;
}

export function GameDashboard({ mySeat, myName }: GameDashboardProps) {
  const { gameState, isConnected, sendAction } = useGameSocket();

  if (!gameState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.pinkPrimary} />
        <Text style={styles.loadingText}>Syncing table state...</Text>
      </View>
    );
  }

  const { roundWind, roundNumber, honba, riichiPot, scores, dealerSeat } = gameState;
  const isDealer = dealerSeat === mySeat;
  const myScore = scores[mySeat] ?? 0;

  return (
    <View style={styles.container}>
      {/* TOP LEFT: Indicators */}
      <View style={styles.topIndicators}>
        <View style={styles.indicatorPill}>
          <Text style={styles.indicatorText}>🀄 {riichiPot * 1000} pts</Text>
        </View>
        <View style={styles.indicatorPill}>
          <Text style={styles.indicatorText}>🔄 Honba: {honba}</Text>
        </View>
        {!isConnected && (
          <View style={[styles.indicatorPill, { borderColor: colors.error }]}>
            <Text style={[styles.indicatorText, { color: colors.error }]}>Offline</Text>
          </View>
        )}
      </View>

      {/* CENTER: Personal Dashboard */}
      <View style={styles.centerStage}>
        <View style={styles.roundBox}>
          <Text style={styles.roundText}>
            {roundWind.toUpperCase()} {roundNumber}
          </Text>
        </View>
        
        <Text style={styles.playerName}>{myName}</Text>
        <Text style={styles.playerScore}>{myScore}</Text>
        
        {isDealer && (
          <View style={styles.dealerBadge}>
            <Text style={styles.dealerText}>DEALER</Text>
          </View>
        )}
      </View>

      {/* BOTTOM: Action Bar */}
      <View style={styles.actionBar}>
        <Pressable 
          style={styles.actionBtn}
          onPress={() => sendAction({ action: "DECLARE_RIICHI", seat: mySeat })}
        >
          <Text style={styles.actionBtnText}>Riichi</Text>
        </Pressable>

        <Pressable 
          style={[styles.actionBtn, styles.winBtn]}
          // Note: You'll eventually want to open a small modal to pick WHO you ronned and how many Han!
          onPress={() => console.log("Open Ron Modal")}
        >
          <Text style={styles.winBtnText}>Ron</Text>
        </Pressable>

        <Pressable 
          style={[styles.actionBtn, styles.winBtn]}
          onPress={() => console.log("Open Tsumo Modal")}
        >
          <Text style={styles.winBtnText}>Tsumo</Text>
        </Pressable>
      </View>

      {/* Exhaustive Draw - Only visible if Dealer */}
      {isDealer && (
        <Pressable 
          style={styles.drawBtn}
          onPress={() => console.log("Open Draw Modal to select Tenpai seats")}
        >
          <Text style={styles.drawBtnText}>Exhaustive Draw</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontWeight: "600",
  },
  topIndicators: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  indicatorPill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  indicatorText: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 14,
  },
  centerStage: {
    alignItems: "center",
    justifyContent: "center",
  },
  roundBox: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.pinkPrimary,
    marginBottom: spacing.xl,
  },
  roundText: {
    color: colors.pinkPrimary,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 2,
  },
  playerName: {
    color: colors.textSecondary,
    fontSize: 20,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  playerScore: {
    color: colors.textPrimary,
    fontSize: 64,
    fontWeight: "900",
    letterSpacing: -2,
  },
  dealerBadge: {
    marginTop: spacing.md,
    backgroundColor: colors.pinkAccent,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dealerText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1,
  },
  actionBar: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    alignItems: "center",
  },
  winBtn: {
    backgroundColor: colors.pinkAccent,
    borderColor: colors.pinkAccent,
  },
  actionBtnText: {
    color: colors.textPrimary,
    fontWeight: "800",
    fontSize: 18,
  },
  winBtnText: {
    color: colors.white,
    fontWeight: "900",
    fontSize: 18,
  },
  drawBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
  },
  drawBtnText: {
    color: colors.textSecondary,
    fontWeight: "800",
    fontSize: 16,
  },
});