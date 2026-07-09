import { useState } from "react";
import { Link, router } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../../src/context/auth-context";
import { ApiError } from "../../src/api/client";
import { colors, radii, spacing } from "../../src/theme/colors";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setError(null);
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    if (pin.trim().length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    setIsSubmitting(true);
    try {
      await register(name.trim(), pin.trim());
      router.replace("/lobby");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Couldn't reach the server.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Riichi Tracker</Text>
      <Text style={styles.title}>Register</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="PIN (min 4 digits)"
          placeholderTextColor={colors.textMuted}
          value={pin}
          onChangeText={setPin}
          secureTextEntry
          keyboardType="number-pad"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleRegister}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>

        <Link href="/auth/login" style={styles.link}>
          Already have an account? Log in
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  eyebrow: {
    color: colors.pinkMuted,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 3,
    fontSize: 11,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: colors.pinkPrimary,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
    marginTop: spacing.sm,
  },
  buttonPressed: {
    backgroundColor: colors.pinkStrong,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  link: {
    marginTop: spacing.md,
    textAlign: "center",
    color: colors.pinkMuted,
    fontWeight: "600",
  },
  error: {
    color: colors.error,
    fontSize: 14,
  },
});
