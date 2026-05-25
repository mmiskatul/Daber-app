import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "./theme";
import {
  loginWithApple,
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail
} from "./auth";
import { User } from "firebase/auth";

type AuthMode = "login" | "register";

type Props = {
  onAuthenticated: (user: User) => void;
};

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState("");

  async function run(name: string, action: () => Promise<User>) {
    setError("");
    setBusy(name);

    try {
      const user = await action();
      onAuthenticated(user);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>STEP 0 · SIGN IN</Text>
          <Text style={styles.title}>
            Welcome to <Text style={styles.titleAccent}>Daber.</Text>
          </Text>
          <Text style={styles.subtitle}>
            Choose how you want to continue. We keep this short.
          </Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.actions}>
          <Pressable
            disabled={busy !== null}
            style={[styles.primaryButton, busy ? styles.disabled : null]}
            onPress={() => run("apple", loginWithApple)}
          >
            <Text style={styles.primaryButtonText}>{busy === "apple" ? "Connecting..." : "Continue with Apple"}</Text>
          </Pressable>

          <Pressable
            disabled={busy !== null}
            style={[styles.outlineButton, busy ? styles.disabled : null]}
            onPress={() => run("google", loginWithGoogle)}
          >
            <Text style={styles.outlineButtonText}>{busy === "google" ? "Connecting..." : "Continue with Google"}</Text>
          </Pressable>

          <View style={styles.formCard}>
            <View style={styles.modeRow}>
              <Pressable onPress={() => setMode("login")}>
                <Text style={[styles.modeText, mode === "login" ? styles.modeTextActive : null]}>Login</Text>
              </Pressable>
              <Pressable onPress={() => setMode("register")}>
                <Text style={[styles.modeText, mode === "register" ? styles.modeTextActive : null]}>Register</Text>
              </Pressable>
            </View>

            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              secureTextEntry
              placeholder="Password"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              disabled={busy !== null || !email.trim() || password.length < 6}
              style={[styles.primaryButton, (!email.trim() || password.length < 6 || busy) ? styles.disabled : null]}
              onPress={() =>
                run(
                  mode,
                  () => mode === "login" ? loginWithEmail(email.trim(), password) : registerWithEmail(email.trim(), password)
                )
              }
            >
              <Text style={styles.primaryButtonText}>
                {busy === mode ? "Please wait..." : mode === "login" ? "Login with Email" : "Create Account"}
              </Text>
            </Pressable>
            <Text style={styles.helperText}>
              {mode === "register"
                ? "Create a Firebase account and sync it to the backend."
                : "Sign in with your Firebase email/password account."}
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.footnote}>
            By continuing you agree to our Terms and Privacy.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bone
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenY,
    paddingBottom: 28
  },
  headerBlock: {
    marginTop: 24
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.inkMute,
    marginBottom: 16
  },
  title: {
    fontSize: 40,
    color: colors.ink,
    lineHeight: 46
  },
  titleAccent: {
    color: colors.terracotta
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    color: colors.inkMute,
    lineHeight: 22
  },
  spacer: {
    flex: 1
  },
  actions: {
    gap: 12
  },
  primaryButton: {
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: "center"
  },
  primaryButtonText: {
    color: colors.bone,
    fontSize: 16,
    fontWeight: "600"
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: "transparent"
  },
  outlineButtonText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "500"
  },
  formCard: {
    backgroundColor: colors.paper,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 10
  },
  modeRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 4
  },
  modeText: {
    color: colors.inkMute,
    fontSize: 14
  },
  modeTextActive: {
    color: colors.terracotta,
    fontWeight: "700"
  },
  input: {
    backgroundColor: colors.bone,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: colors.ink,
    fontSize: 15
  },
  helperText: {
    color: colors.inkMute,
    fontSize: 12,
    lineHeight: 18
  },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14
  },
  errorText: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18
  },
  footnote: {
    marginTop: 8,
    textAlign: "center",
    color: colors.inkFaint,
    fontSize: 12,
    lineHeight: 18
  },
  disabled: {
    opacity: 0.55
  }
});
