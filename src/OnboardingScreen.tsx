import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { User } from "firebase/auth";
import { saveOnboarding } from "./api";
import { colors, spacing } from "./theme";

type OnboardingData = {
  native: string;
  level: string;
  goal: string;
  voice: string;
};

type Props = {
  user: User;
  onDone: (data: OnboardingData) => void;
};

const STEPS = ["LANGUAGE", "LEVEL", "GOAL", "VOICE"];

const OPTIONS = {
  native: ["English", "Español", "Français", "Русский", "Other"],
  level: ["A1", "A2", "B1", "B2", "C1"],
  goal: ["travel", "family", "work", "culture"],
  voice: ["dana", "noam", "shira"]
} as const;

export function OnboardingScreen({ user, onDone }: Props) {
  const [step, setStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState<OnboardingData>({
    native: "English",
    level: "A2",
    goal: "travel",
    voice: "dana"
  });

  const stepKey = step === 0 ? "native" : step === 1 ? "level" : step === 2 ? "goal" : "voice";
  const values = OPTIONS[stepKey];

  async function handleContinue() {
    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await saveOnboarding(user, data);
      onDone(data);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Failed to save onboarding.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>Daber</Text>
          <Text style={styles.counter}>{String(step + 1).padStart(2, "0")} / 04</Text>
        </View>

        <View style={styles.progressRow}>
          {STEPS.map((item, index) => (
            <View key={item} style={[styles.progressBar, index <= step ? styles.progressBarActive : null]} />
          ))}
        </View>

        <View style={styles.content}>
          <Text style={styles.eyebrow}>QUESTION {String(step + 1).padStart(2, "0")}</Text>
          <Text style={styles.title}>
            {step === 0 ? "What’s your native language?" : step === 1 ? "What’s your level?" : step === 2 ? "Why are you learning?" : "Pick a voice."}
          </Text>
          <Text style={styles.subtitle}>
            {step === 0
              ? "Dana will use this for explanations."
              : step === 1
              ? "We tailor the lesson difficulty to this."
              : step === 2
              ? "We bias scenarios and vocabulary toward your goal."
              : "You can switch this later in the app."}
          </Text>

          <View style={styles.options}>
            {values.map((value, index) => {
              const selected = data[stepKey] === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.optionCard, selected ? styles.optionCardSelected : null]}
                  onPress={() => setData((current) => ({ ...current, [stepKey]: value }))}
                >
                  <Text style={[styles.optionIndex, selected ? styles.optionTextSelected : null]}>
                    {String(index + 1).padStart(2, "0")}
                  </Text>
                  <View style={styles.optionBody}>
                    <Text style={[styles.optionLabel, selected ? styles.optionTextSelected : null]}>{value}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        <Pressable style={[styles.button, loading ? styles.buttonDisabled : null]} disabled={loading} onPress={handleContinue}>
          <Text style={styles.buttonText}>{step < 3 ? "Continue" : loading ? "Saving..." : "Begin learning"}</Text>
        </Pressable>
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
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 22
  },
  header: {
    flexDirection: "row",
    alignItems: "center"
  },
  wordmark: {
    fontSize: 26,
    color: colors.ink,
    fontWeight: "700"
  },
  counter: {
    marginLeft: "auto",
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 2
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(26,20,16,0.10)"
  },
  progressBarActive: {
    backgroundColor: colors.terracotta
  },
  content: {
    flex: 1,
    paddingTop: 18
  },
  eyebrow: {
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 12
  },
  title: {
    fontSize: 31,
    color: colors.ink,
    lineHeight: 38,
    marginBottom: 10
  },
  subtitle: {
    color: colors.inkMute,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 290
  },
  options: {
    gap: 12
  },
  optionCard: {
    minHeight: 82,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(26,20,16,0.08)",
    backgroundColor: "rgba(236,226,208,0.72)",
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  optionCardSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  optionIndex: {
    width: 26,
    color: colors.inkMute,
    fontSize: 11
  },
  optionBody: {
    flex: 1
  },
  optionLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600"
  },
  optionTextSelected: {
    color: colors.bone
  },
  errorBox: {
    marginTop: 16,
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12
  },
  errorText: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18
  },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center"
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: colors.bone,
    fontSize: 16,
    fontWeight: "600"
  }
});
