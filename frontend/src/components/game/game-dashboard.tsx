import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { colors, radii, spacing } from "../../theme/colors";
import { useGameSocket } from "../../hooks/use-game-socket";

interface GameDashboardProps {
  roomId : number| string;
  mySeat: number;
  myName: string;
  playerNamesMap: Record<number, string>;
}

export function GameDashboard({
  roomId,
  mySeat,
  myName,
  playerNamesMap,
}: GameDashboardProps) {
  const { gameState, isConnected, sendAction } = useGameSocket(Number(roomId));


  const [activeModal, setActiveModal] = React.useState<"ron" | "tsumo" | "draw" | null>(null);
 
  const [selectedLoser, setSelectedLoser] = React.useState<number | null>(null);
  const [selectedHan, setSelectedHan] = React.useState<number>(1);
  const [tenpaiSeats, setTenpaiSeats] = React.useState<Record<number, boolean>>({ 1: false, 2: false, 3: false, 4: false });

  const ALL_SEAT_NUMBERS = [1, 2, 3, 4];

  if (!gameState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.pinkPrimary} />
        <Text style={styles.loadingText}>Syncing table state...</Text>
      </View>
    );
  }

  const activeScores =
    gameState.currentScores || (gameState as any).scores || {};
  const {
    roundWind,
    roundNumber,
    honba,
    riichiPot,
    dealerSeat,
    riichiDeclared,
    seatPlayers,
  } = gameState;


  const pendingRonClaims: Record<number, { winnerSeat: number; han: number }[]> =
    (gameState as any).pendingRonClaims ?? {};
  const claimsAgainstMe = pendingRonClaims[mySeat] ?? [];

  const myClaimEntry = Object.entries(pendingRonClaims)
    .map(([loserSeat, claims]) => ({
      loserSeat: Number(loserSeat),
      claim: claims.find((c) => c.winnerSeat === mySeat),
    }))
    .find((entry) => entry.claim);

  const closeModal = () => {
    setActiveModal(null);
    setSelectedLoser(null);
    setSelectedHan(1);
    setTenpaiSeats({ 1: false, 2: false, 3: false, 4: false });
  };

  const toggleTenpaiSeat = (seat: number) => {
    setTenpaiSeats((prev) => ({ ...prev, [seat]: !prev[seat] }));
  };

  const adjustHan = (delta: number) => {
    setSelectedHan((prev) => Math.min(13, Math.max(1, prev + delta)));
  };

  const openRonModal = () => {
    // Pre-fill from an existing claim, if I'm editing one.
    if (myClaimEntry) {
      setSelectedLoser(myClaimEntry.loserSeat);
      setSelectedHan(myClaimEntry.claim!.han);
    }
    setActiveModal("ron");
  };

  const claimRon = () => {
    if (selectedLoser === null) return;
    sendAction({
      action: "CLAIM_RON",
      winnerSeat: mySeat,
      loserSeat: selectedLoser,
      han: selectedHan,
    });
    closeModal();
  };

  const cancelMyClaim = () => {
    if (!myClaimEntry) return;
    sendAction({
      action: "CANCEL_RON_CLAIM",
      winnerSeat: mySeat,
      loserSeat: myClaimEntry.loserSeat,
    });
  };

  const confirmClaimsAgainstMe = () => {
    sendAction({ action: "CONFIRM_RON", loserSeat: mySeat });
  };

  const declineClaimsAgainstMe = () => {
    sendAction({ action: "DECLINE_RON_CLAIMS", loserSeat: mySeat });
  };

  const confirmTsumo = () => {
    sendAction({
      action: "DECLARE_TSUMO",
      winnerSeat: mySeat,
      han: selectedHan,
    });
    closeModal();
  };

  const confirmDraw = () => {
    const tenpai = ALL_SEAT_NUMBERS.filter((seat) => tenpaiSeats[seat]);
    sendAction({ action: "EXHAUSTIVE_DRAW", tenpaiSeats: tenpai });
    closeModal();
  };

  // Seating
  const rightSeat = (mySeat % 4) + 1; // Shimocha
  const topSeat = ((mySeat + 1) % 4) + 1; // Toimen
  const leftSeat = ((mySeat + 2) % 4) + 1; // Kamicha

  const getPlayerNameBySeat = (seatNum: number) => {
    if (seatNum === mySeat) return myName;
    const playerId = seatPlayers ? seatPlayers[seatNum] : null;
    return playerId && playerNamesMap[playerId]
      ? playerNamesMap[playerId]
      : `Seat ${seatNum}`;
  };

  const renderPlayer = (seat: number, name: string, rotation: string) => {
    const isDealer = dealerSeat === seat;
    const hasRiichi = riichiDeclared?.includes(seat);
    const score = activeScores[seat] ?? 0;

    return (
      <View
        style={[styles.playerWrapper, { transform: [{ rotate: rotation }] }]}
      >
        <Text style={[styles.playerName, isDealer && styles.dealerName]}>
          {name} {isDealer ? "👑" : ""}
        </Text>
        <Text style={[styles.playerScore, isDealer && styles.dealerScore]}>
          {score}
        </Text>
        {hasRiichi && (
          <View style={styles.riichiStick}>
            <View style={styles.riichiDot} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* STATUS BAR */}
      <View style={styles.topIndicators}>
        {!isConnected && (
          <View style={[styles.indicatorPill, { borderColor: colors.error }]}>
            <Text style={[styles.indicatorText, { color: colors.error }]}>
              Offline
            </Text>
          </View>
        )}
      </View>

      <View style={styles.tableArea}>
        {/*Toimen */}
        <View style={styles.tableRow}>
          {renderPlayer(topSeat, getPlayerNameBySeat(topSeat), "180deg")}
        </View>

        {/*Kamicha + Center + Shimocha */}
        <View
          style={[
            styles.tableRow,
            { justifyContent: "center", gap: spacing.md },
          ]}
        >
          {/*Kamicha*/}
          {renderPlayer(leftSeat, getPlayerNameBySeat(leftSeat), "90deg")}

          {/* Center Board */}
          <View style={styles.centerBoard}>
            <Text style={styles.roundText}>
              {roundWind.toUpperCase()} {roundNumber}
            </Text>
            <Text style={styles.boardDetail}>🀄 {riichiPot * 1000} pts</Text>
            <Text style={styles.boardDetail}>🔄 Honba: {honba}</Text>
          </View>

          {/*Shimocha*/}
          {renderPlayer(rightSeat, getPlayerNameBySeat(rightSeat), "-90deg")}
        </View>

        {/* You*/}
        <View style={styles.tableRow}>
          {renderPlayer(mySeat, myName, "0deg")}
        </View>
      </View>

      {/* PENDING RON CLAIMS AGAINST ME — only I can confirm these, so only I can move my own points */}
      {claimsAgainstMe.length > 0 && (
        <View style={styles.claimBanner}>
          <Text style={styles.claimBannerTitle}>Ron called on you</Text>
          {claimsAgainstMe.map((claim) => (
            <Text key={claim.winnerSeat} style={styles.claimBannerRow}>
              Pay {getPlayerNameBySeat(claim.winnerSeat)}: {claim.han} han
            </Text>
          ))}
          <View style={styles.modalActions}>
            <Pressable style={styles.cancelBtn} onPress={declineClaimsAgainstMe}>
              <Text style={styles.cancelBtnText}>Decline</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={confirmClaimsAgainstMe}>
              <Text style={styles.confirmBtnText}>Confirm & Pay</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* MY OWN OUTSTANDING RON CLAIM */}
      {myClaimEntry && (
        <View style={styles.claimBanner}>
          <Text style={styles.claimBannerTitle}>Waiting for confirmation</Text>
          <Text style={styles.claimBannerRow}>
            {myClaimEntry.claim!.han} han vs {getPlayerNameBySeat(myClaimEntry.loserSeat)}
          </Text>
          <View style={styles.modalActions}>
            <Pressable style={styles.cancelBtn} onPress={cancelMyClaim}>
              <Text style={styles.cancelBtnText}>Cancel Claim</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={openRonModal}>
              <Text style={styles.confirmBtnText}>Edit</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ACTION BAR */}
      <View style={styles.actionBar}>
        <Pressable
          style={[
            styles.actionBtn,
            !!riichiDeclared?.includes(mySeat) && styles.actionBtnDisabled,
          ]}
          disabled={!!riichiDeclared?.includes(mySeat)}
          onPress={() => sendAction({ action: "DECLARE_RIICHI", seat: mySeat })}
        >
          <Text style={styles.actionBtnText}>
            {riichiDeclared?.includes(mySeat) ? "Riichi'd" : "Riichi"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.winBtn]}
          onPress={openRonModal}
        >
          <Text style={styles.winBtnText}>Ron</Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.winBtn]}
          onPress={() => setActiveModal("tsumo")}
        >
          <Text style={styles.winBtnText}>Tsumo</Text>
        </Pressable>
      </View>

      {dealerSeat === mySeat && (
        <Pressable
          style={styles.drawBtn}
          onPress={() => setActiveModal("draw")}
        >
          <Text style={styles.drawBtnText}>Exhaustive Draw</Text>
        </Pressable>
      )}

      {/* RON MODAL — pressing Ron means *you* won; you're only telling us who dealt in */}
      <Modal
        visible={activeModal === "ron"}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ron</Text>
            <Text style={styles.modalSubtitle}>
              You're declaring your own win. This just tells the table who
              dealt into you — they'll confirm before any points move.
            </Text>

            <Text style={styles.sectionLabel}>Who dealt in?</Text>
            <View style={styles.chipRow}>
              {ALL_SEAT_NUMBERS.filter((seat) => seat !== mySeat).map((seat) => (
                <Pressable
                  key={seat}
                  style={[
                    styles.seatChip,
                    selectedLoser === seat && styles.loserChipSelected,
                  ]}
                  onPress={() => setSelectedLoser(seat)}
                >
                  <Text
                    style={[
                      styles.seatChipText,
                      selectedLoser === seat && styles.seatChipTextSelected,
                    ]}
                  >
                    {getPlayerNameBySeat(seat)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Your Han</Text>
            <View style={styles.stepperRow}>
              <Pressable style={styles.stepperBtn} onPress={() => adjustHan(-1)}>
                <Text style={styles.stepperBtnText}>-</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{selectedHan}</Text>
              <Pressable style={styles.stepperBtn} onPress={() => adjustHan(1)}>
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.confirmBtn,
                  selectedLoser === null && styles.confirmBtnDisabled,
                ]}
                disabled={selectedLoser === null}
                onPress={claimRon}
              >
                <Text style={styles.confirmBtnText}>Send Claim</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* TSUMO MODAL — pressing Tsumo means *you* self-drew; just say your han */}
      <Modal
        visible={activeModal === "tsumo"}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tsumo</Text>
            <Text style={styles.modalSubtitle}>Self-draw win. What's your han?</Text>

            <Text style={styles.sectionLabel}>Your Han</Text>
            <View style={styles.stepperRow}>
              <Pressable style={styles.stepperBtn} onPress={() => adjustHan(-1)}>
                <Text style={styles.stepperBtnText}>-</Text>
              </Pressable>
              <Text style={styles.stepperValue}>{selectedHan}</Text>
              <Pressable style={styles.stepperBtn} onPress={() => adjustHan(1)}>
                <Text style={styles.stepperBtnText}>+</Text>
              </Pressable>
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={confirmTsumo}>
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* EXHAUSTIVE DRAW MODAL */}
      <Modal
        visible={activeModal === "draw"}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Exhaustive Draw</Text>

            <Text style={styles.sectionLabel}>Who's Tenpai?</Text>
            <View style={styles.chipRow}>
              {ALL_SEAT_NUMBERS.map((seat) => (
                <Pressable
                  key={seat}
                  style={[
                    styles.seatChip,
                    tenpaiSeats[seat] && styles.seatChipSelected,
                  ]}
                  onPress={() => toggleTenpaiSeat(seat)}
                >
                  <Text
                    style={[
                      styles.seatChipText,
                      tenpaiSeats[seat] && styles.seatChipTextSelected,
                    ]}
                  >
                    {getPlayerNameBySeat(seat)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={confirmDraw}>
                <Text style={styles.confirmBtnText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: spacing.xl,
    justifyContent: "space-between",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    color: colors.textSecondary,
    marginTop: spacing.md,
    fontWeight: "600",
  },

  topIndicators: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: spacing.md,
  },
  indicatorPill: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 99,
  },
  indicatorText: { fontWeight: "800", fontSize: 12 },

  // Table Grid Styles
  tableArea: {
    flex: 1,
    justifyContent: "center",
    position: "relative",
    width: "100%",
    minHeight: 320,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },

  centerBoard: {
    backgroundColor: colors.backgroundDeep,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  roundText: {
    color: colors.pinkPrimary,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },
  boardDetail: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },

  playerWrapper: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    minWidth: 80,
    minHeight: 80,
  },
  playerName: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  dealerName: { color: colors.pinkPrimary, fontWeight: "900" },
  playerScore: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1,
  },
  dealerScore: { color: colors.pinkPrimary },

  riichiStick: {
    width: 30,
    height: 4,
    backgroundColor: colors.white,
    borderRadius: 2,
    marginTop: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  riichiDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.error,
  },

  actionBar: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
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
  actionBtnText: { color: colors.textPrimary, fontWeight: "800", fontSize: 14 },
  winBtnText: { color: colors.white, fontWeight: "900", fontSize: 14 },
  drawBtn: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
  },
  drawBtnText: { color: colors.textSecondary, fontWeight: "800", fontSize: 14 },

  actionBtnDisabled: { opacity: 0.4 },

  claimBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.backgroundDeep,
    borderWidth: 1,
    borderColor: colors.pinkAccent,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  claimBannerTitle: {
    color: colors.pinkPrimary,
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 4,
  },
  claimBannerRow: {
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 2,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: spacing.md,
  },
  modalSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  seatChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundDeep,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 99,
  },
  seatChipSelected: {
    backgroundColor: colors.pinkAccent,
    borderColor: colors.pinkAccent,
  },
  loserChipSelected: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  seatChipDisabled: { opacity: 0.3 },
  seatChipText: { color: colors.textPrimary, fontWeight: "700", fontSize: 13 },
  seatChipTextSelected: { color: colors.white },

  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: { color: colors.textPrimary, fontSize: 20, fontWeight: "900" },
  stepperValue: {
    color: colors.pinkPrimary,
    fontSize: 24,
    fontWeight: "900",
    minWidth: 32,
    textAlign: "center",
  },

  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  cancelBtnText: { color: colors.textSecondary, fontWeight: "800" },
  confirmBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.pinkPrimary,
    alignItems: "center",
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: colors.white, fontWeight: "900" },
});