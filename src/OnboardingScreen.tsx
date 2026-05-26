import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { User } from "firebase/auth";
import { getOnboarding, saveOnboarding } from "./api";
import { colors, radii } from "./theme";

type OnboardingData = {
  native: string;
  level: string;
  goal: string;
  voice: string;
};

type Props = {
  user: User;
  onDone: (data: OnboardingData) => void;
  onBack?: () => void;
};

const STEPS = ["LANGUAGE", "LEVEL", "GOAL", "VOICE"];

const LANGUAGE_OPTIONS = [
  { id: "English", label: "English", sub: "Explanations in English", he: "אנגלית" },
  { id: "Español", label: "Español", sub: "Las explicaciones en español", he: "ספרדית" },
  { id: "Français", label: "Français", sub: "Explications en français", he: "צרפתית" },
  { id: "Русский", label: "Русский", sub: "Объяснения на русском", he: "רוסית" },
  { id: "Other", label: "Other", sub: "We'll default to English", he: "" }
];

const LEVEL_OPTIONS = [
  { id: "A1", label: "Breakthrough", sub: "A few words. Need lots of support.", color: "#E8B4A0" },
  { id: "A2", label: "Elementary", sub: "Short sentences. Common topics.", color: "#D9A35E" },
  { id: "B1", label: "Intermediate", sub: "Daily life. Errors are okay.", color: "#A8C5D1" },
  { id: "B2", label: "Upper-Int.", sub: "Abstract topics, clear opinions.", color: "#6B7A45" },
  { id: "C1", label: "Advanced", sub: "Fluent + nuance.", color: "#B8462C" }
];

const GOAL_OPTIONS = [
  { id: "travel", label: "Travel", sub: "Street Hebrew, directions, errands." },
  { id: "family", label: "Family", sub: "Warm conversation with relatives and neighbors." },
  { id: "work", label: "Work", sub: "Professional Hebrew and clearer confidence." },
  { id: "culture", label: "Culture", sub: "Shows, articles, jokes, and nuance." }
];

const VOICE_OPTIONS = [
  { id: "dana", label: "Dana", sub: "Warm, patient, direct." },
  { id: "noam", label: "Noam", sub: "Light, steady, encouraging." },
  { id: "shira", label: "Shira", sub: "Sharper pace, expressive tone." }
];

export function OnboardingScreen({ user, onDone, onBack }: Props) {
  const [step, setStep] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [data, setData] = React.useState<OnboardingData>({
    native: "English",
    level: "A2",
    goal: "travel",
    voice: "dana"
  });

  React.useEffect(() => {
    let active = true;

    async function hydrateOnboarding() {
      try {
        const existing = await getOnboarding(user);

        if (active && existing) {
          setData(existing);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load onboarding.");
        }
      }
    }

    void hydrateOnboarding();

    return () => {
      active = false;
    };
  }, [user]);

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

  function handleBack() {
    if (step > 0) {
      setStep((current) => current - 1);
      return;
    }

    onBack?.();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backPill}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.wordmark}>דַּבֵּר</Text>
        <View style={styles.headerSpacer} />
        <Text style={styles.counter}>{String(step + 1).padStart(2, "0")} / 04</Text>
      </View>

      <View style={styles.progressRow}>
        {STEPS.map((item, index) => (
          <View key={item} style={[styles.progressBar, index <= step ? styles.progressBarActive : null]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {step === 0 ? (
          <>
            <Text style={styles.eyebrow}>QUESTION 01</Text>
            <Text style={styles.heTitle}>מֶה הַשָּׁפָה שֶׁלָּךְ?</Text>
            <Text style={styles.enTitle}>What&apos;s your native language?</Text>
            <Text style={styles.subtitle}>
              Dana will weave it in at lower levels and write encouragement in it.
            </Text>

            <View style={styles.optionStack}>
              {LANGUAGE_OPTIONS.map((option, index) => {
                const selected = data.native === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.optionCard, selected ? styles.optionCardSelected : null]}
                    onPress={() => setData((current) => ({ ...current, native: option.id }))}
                  >
                    <Text style={[styles.optionIndex, selected ? styles.optionSelectedText : null]}>
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                    <View style={styles.optionBody}>
                      <Text style={[styles.optionLabel, selected ? styles.optionSelectedText : null]}>{option.label}</Text>
                      <Text style={[styles.optionSub, selected ? styles.optionSelectedSub : null]}>{option.sub}</Text>
                    </View>
                    {option.he ? <Text style={[styles.optionHe, selected ? styles.optionSelectedText : null]}>{option.he}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.eyebrow}>QUESTION 02</Text>
            <Text style={styles.heTitle}>מָה הָרָמָה שֶׁלָּךְ?</Text>
            <Text style={styles.enTitle}>Where are you starting from?</Text>
            <Text style={styles.subtitle}>
              CEFR band. Dana adjusts difficulty, pace, and how aggressively she corrects.
            </Text>

            <View style={styles.levelStack}>
              {LEVEL_OPTIONS.map((option) => {
                const selected = data.level === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.levelCard, selected ? styles.levelCardSelected : null]}
                    onPress={() => setData((current) => ({ ...current, level: option.id }))}
                  >
                    <Text style={[styles.levelCode, selected ? styles.optionSelectedText : null]}>{option.id}</Text>
                    <View style={[styles.levelDivider, selected ? styles.levelDividerSelected : null]} />
                    <View style={styles.levelBody}>
                      <Text style={[styles.levelLabel, selected ? styles.optionSelectedText : null]}>{option.label}</Text>
                      <Text style={[styles.levelSub, selected ? styles.optionSelectedSub : null]}>{option.sub}</Text>
                    </View>
                    <View style={[styles.levelDot, { backgroundColor: option.color }]} />
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={styles.eyebrow}>QUESTION 03</Text>
            <Text style={styles.heTitle}>לָמָה אַתָּה לוֹמֵד?</Text>
            <Text style={styles.enTitle}>Why are you learning?</Text>
            <Text style={styles.subtitle}>
              We bias scenarios and vocabulary toward your goal.
            </Text>

            <View style={styles.optionStack}>
              {GOAL_OPTIONS.map((option, index) => {
                const selected = data.goal === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.optionCard, selected ? styles.optionCardSelected : null]}
                    onPress={() => setData((current) => ({ ...current, goal: option.id }))}
                  >
                    <Text style={[styles.optionIndex, selected ? styles.optionSelectedText : null]}>
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                    <View style={styles.optionBody}>
                      <Text style={[styles.optionLabel, selected ? styles.optionSelectedText : null]}>{option.label}</Text>
                      <Text style={[styles.optionSub, selected ? styles.optionSelectedSub : null]}>{option.sub}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.eyebrow}>QUESTION 04</Text>
            <Text style={styles.heTitle}>אֵיזֶה קוֹל?</Text>
            <Text style={styles.enTitle}>Pick a voice.</Text>
            <Text style={styles.subtitle}>
              You can switch this later in the app.
            </Text>

            <View style={styles.optionStack}>
              {VOICE_OPTIONS.map((option, index) => {
                const selected = data.voice === option.id;
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.optionCard, selected ? styles.optionCardSelected : null]}
                    onPress={() => setData((current) => ({ ...current, voice: option.id }))}
                  >
                    <Text style={[styles.optionIndex, selected ? styles.optionSelectedText : null]}>
                      {String(index + 1).padStart(2, "0")}
                    </Text>
                    <View style={styles.optionBody}>
                      <Text style={[styles.optionLabel, selected ? styles.optionSelectedText : null]}>{option.label}</Text>
                      <Text style={[styles.optionSub, selected ? styles.optionSelectedSub : null]}>{option.sub}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.button, loading ? styles.buttonDisabled : null]} disabled={loading} onPress={handleContinue}>
          <Text style={styles.buttonText}>{step < 3 ? "Continue" : loading ? "Saving..." : "Begin learning"}</Text>
          <Text style={styles.buttonArrow}>→</Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 16
  },
  backPill: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line
  },
  backText: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 22
  },
  wordmark: {
    fontSize: 26,
    color: colors.ink,
    fontWeight: "700"
  },
  headerSpacer: {
    flex: 1
  },
  counter: {
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 2
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 22,
    paddingBottom: 12
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(26,20,16,0.10)"
  },
  progressBarActive: {
    backgroundColor: colors.terracotta
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 20
  },
  eyebrow: {
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 16
  },
  heTitle: {
    fontSize: 31,
    lineHeight: 38,
    color: colors.ink,
    marginBottom: 10
  },
  enTitle: {
    fontSize: 16,
    color: colors.inkSoft,
    marginBottom: 14,
    fontStyle: "italic"
  },
  subtitle: {
    color: colors.inkMute,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 24,
    maxWidth: 290
  },
  optionStack: {
    gap: 12
  },
  optionCard: {
    minHeight: 82,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(26,20,16,0.08)",
    backgroundColor: "rgba(236,226,208,0.72)",
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
    fontSize: 11,
    textAlign: "center",
    opacity: 0.55
  },
  optionBody: {
    flex: 1
  },
  optionLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600"
  },
  optionSub: {
    marginTop: 4,
    color: colors.inkMute,
    fontSize: 12,
    lineHeight: 16
  },
  optionHe: {
    color: colors.inkMute,
    fontSize: 22
  },
  optionSelectedText: {
    color: colors.bone
  },
  optionSelectedSub: {
    color: "rgba(244,236,222,0.70)"
  },
  levelStack: {
    gap: 8
  },
  levelCard: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  levelCardSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink
  },
  levelCode: {
    width: 36,
    color: colors.ink,
    fontSize: 22,
    fontWeight: "500"
  },
  levelDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.line
  },
  levelDividerSelected: {
    backgroundColor: "rgba(244,236,222,0.2)"
  },
  levelBody: {
    flex: 1
  },
  levelLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "500"
  },
  levelSub: {
    marginTop: 2,
    color: colors.inkMute,
    fontSize: 12
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: radii.pill
  },
  errorBox: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1
  },
  errorText: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 22
  },
  button: {
    minHeight: 56,
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: colors.bone,
    fontSize: 16,
    fontWeight: "600"
  },
  buttonArrow: {
    color: colors.bone,
    fontSize: 16,
    fontWeight: "600"
  }
});
