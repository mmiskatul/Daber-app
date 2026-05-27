import React from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii } from "./theme";

type Props = {
  onExit: () => void;
};

type Round = {
  from: "he" | "en";
  source: string;
  target: string;
  latin?: string;
  options: string[];
  correct: number;
  note: string;
};

type Phase = "intro" | "playing" | "done";

const ACCENT = "#5B4B8A";

const ROUNDS: Round[] = [
  {
    from: "he",
    source: "שָׁלוֹם",
    latin: "shalom",
    target: "hello",
    options: ["goodbye", "hello"],
    correct: 1,
    note: "Also means “peace” and can be used both on arrival and departure."
  },
  {
    from: "en",
    source: "water",
    target: "מַיִם",
    latin: "mayim",
    options: ["חָלָב", "מַיִם", "יַיִן"],
    correct: 1,
    note: "מַיִם keeps a plural shape even when English treats it as singular."
  },
  {
    from: "he",
    source: "סֵפֶר",
    latin: "sefer",
    target: "book",
    options: ["letter", "book", "paper", "page"],
    correct: 1,
    note: "Same root family connects ספר to book, story, and counting."
  },
  {
    from: "en",
    source: "thank you",
    target: "תּוֹדָה",
    latin: "toda",
    options: ["בְּבַקָּשָׁה", "סְלִיחָה", "תּוֹדָה", "שָׁלוֹם"],
    correct: 2,
    note: "בְּבַקָּשָׁה is “please” or “you’re welcome,” not “thank you.”"
  },
  {
    from: "he",
    source: "אוֹהֵב",
    latin: "ohev",
    target: "love",
    options: ["walk", "eat", "love", "see"],
    correct: 2,
    note: "Present tense, masculine singular: “love” as a live action state."
  },
  {
    from: "en",
    source: "morning",
    target: "בֹּקֶר",
    latin: "boker",
    options: ["לַיְלָה", "עֶרֶב", "צָהֳרַיִם", "בֹּקֶר"],
    correct: 3,
    note: "בֹּקֶר טוֹב means “good morning.” The others are night, evening, and noon."
  }
];

function getRoundPoints(optionCount: number) {
  return 8 + (optionCount - 2) * 4;
}

export function TranslateGameScreen({ onExit }: Props) {
  const [phase, setPhase] = React.useState<Phase>("intro");
  const [idx, setIdx] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [correct, setCorrect] = React.useState(0);
  const [streak, setStreak] = React.useState(0);
  const [bestStreak, setBestStreak] = React.useState(0);
  const [pick, setPick] = React.useState<number | null>(null);

  React.useEffect(() => {
    setPick(null);
  }, [idx]);

  const round = ROUNDS[idx];
  const fromHebrew = round?.from === "he";
  const roundPoints = round ? getRoundPoints(round.options.length) : 0;
  const earnedPoints = pick === round?.correct ? roundPoints * (streak >= 2 ? 2 : 1) : 0;

  function startGame() {
    setPhase("playing");
    setIdx(0);
    setScore(0);
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setPick(null);
  }

  function handlePick(optionIndex: number) {
    if (pick !== null) {
      return;
    }

    setPick(optionIndex);

    if (optionIndex === round.correct) {
      const base = getRoundPoints(round.options.length);
      const bonus = streak >= 2 ? base : 0;
      setScore((value) => value + base + bonus);
      setCorrect((value) => value + 1);
      setStreak((value) => {
        const next = value + 1;
        setBestStreak((best) => Math.max(best, next));
        return next;
      });
    } else {
      setStreak(0);
    }
  }

  function nextRound() {
    if (idx + 1 >= ROUNDS.length) {
      setPhase("done");
      return;
    }

    setIdx((value) => value + 1);
  }

  if (phase === "intro") {
    return (
      <SafeAreaView style={styles.introScreen}>
        <View style={styles.introTopBar}>
          <Pressable style={styles.closePillDark} onPress={onExit}>
            <Text style={styles.closePillDarkText}>×</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.introWatermark}>ת</Text>
          <Text style={styles.introHebrew}>תַּרְגֵּם</Text>
          <Text style={styles.introTitle}>
            Switch{"\n"}
            <Text style={styles.introTitleItalic}>tongues.</Text>
          </Text>
          <Text style={styles.introCopy}>
            A word appears in Hebrew or English. Pick its meaning from two, three, or four options. No audio. Just read fast and clean.
          </Text>

          <View style={styles.introStatsRow}>
            <View style={styles.introStatCard}>
              <Text style={styles.introStatLabel}>LENGTH</Text>
              <Text style={styles.introStatValue}>6 words</Text>
            </View>
            <View style={styles.introStatCard}>
              <Text style={styles.introStatLabel}>DURATION</Text>
              <Text style={styles.introStatValue}>≈ 2 min</Text>
            </View>
          </View>

          <View style={styles.rulesCard}>
            <RuleRow title="Read both ways" body="Some rounds go Hebrew to English, others go English to Hebrew." />
            <RuleRow title="Difficulty ramps" body="Early rounds give 2 choices. Later rounds give 4 with closer distractors." />
            <RuleRow title="Meaning note" body="Every answer includes a short note about nuance, roots, or common confusion." />
          </View>
        </ScrollView>

        <View style={styles.bottomCtaWrap}>
          <Pressable style={styles.primaryButtonPurple} onPress={startGame}>
            <Text style={styles.primaryButtonPurpleText}>Start game</Text>
            <Text style={styles.primaryButtonPurpleText}>→</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "done") {
    const pct = Math.round((correct / ROUNDS.length) * 100);
    const grade =
      pct >= 90
        ? { label: "Excellent.", he: "מְצוּיָּן" }
        : pct >= 70
          ? { label: "Solid.", he: "יָפֶה מְאֹד" }
          : pct >= 50
            ? { label: "Almost there.", he: "כִּמְעַט" }
            : { label: "Try again.", he: "נְסֵה שׁוּב" };

    return (
      <SafeAreaView style={styles.resultsScreen}>
        <View style={styles.resultsTopBar}>
          <Pressable style={styles.closePillLight} onPress={onExit}>
            <Text style={styles.closePillLightText}>×</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.resultsScroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.resultsEyebrow}>SESSION COMPLETE</Text>
          <Text style={styles.resultsTitle}>{grade.label}</Text>
          <Text style={styles.resultsHebrew}>{grade.he}</Text>

          <View style={styles.scoreRing}>
            <Text style={styles.scoreRingValue}>{pct}%</Text>
            <Text style={styles.scoreRingLabel}>ACCURACY</Text>
          </View>

          <View style={styles.resultsStatsRow}>
            <StatCell label="Points" value={`+${score}`} />
            <StatCell label="Correct" value={`${correct}/${ROUNDS.length}`} />
            <StatCell label="Streak" value={`×${Math.max(bestStreak, 1)}`} />
          </View>

          <View style={styles.resultsReward}>
            <View style={styles.resultsRewardDot} />
            <View style={styles.resultsRewardBody}>
              <Text style={styles.resultsRewardTitle}>Good rep quality</Text>
              <Text style={styles.resultsRewardCopy}>Run it again to lock the pairs in faster.</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.resultsActions}>
          <Pressable style={styles.secondaryButton} onPress={onExit}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
          <Pressable style={styles.primaryButtonPurple} onPress={startGame}>
            <Text style={styles.primaryButtonPurpleText}>Play again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.playScreen}>
      <View style={styles.playHeader}>
        <Pressable style={styles.closePillLight} onPress={onExit}>
          <Text style={styles.closePillLightText}>×</Text>
        </Pressable>
        <View style={styles.playHeaderCenter}>
          <Text style={styles.playRound}>Round {idx + 1}/{ROUNDS.length}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((idx + 1) / ROUNDS.length) * 100}%` }]} />
          </View>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreBadgeLabel}>+{score}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.playScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.translateTopRow}>
          <Text style={styles.translateEyebrow}>TRANSLATE</Text>

          <View style={styles.directionPill}>
            <Text style={styles.directionText}>{fromHebrew ? "HE" : "EN"}</Text>
            <Text style={styles.directionArrow}>→</Text>
            <Text style={styles.directionText}>{fromHebrew ? "EN" : "HE"}</Text>
          </View>

          {streak >= 2 ? (
            <View style={styles.streakPill}>
              <Text style={styles.streakPillText}>{streak}</Text>
            </View>
          ) : (
            <View style={styles.streakPillGhost} />
          )}
        </View>

        <View style={styles.sourceCard}>
          <Text style={styles.sourceWatermark}>{fromHebrew ? round.source.charAt(0) : round.source.charAt(0).toUpperCase()}</Text>
          <Text style={styles.sourceLabel}>{fromHebrew ? "HEBREW" : "ENGLISH"}</Text>
          <Text style={fromHebrew ? styles.sourceHebrew : styles.sourceEnglish}>{round.source}</Text>
          {fromHebrew && round.latin ? <Text style={styles.sourceLatin}>{round.latin.toUpperCase()}</Text> : null}
        </View>

        <View style={[styles.optionsGrid, round.options.length === 3 ? styles.optionsGridSingle : null]}>
          {round.options.map((option, optionIndex) => {
            const isCorrect = pick !== null && optionIndex === round.correct;
            const isWrong = pick === optionIndex && optionIndex !== round.correct;
            const dim = pick !== null && !isCorrect && !isWrong;
            const targetIsHebrew = !fromHebrew;

            return (
              <Pressable
                key={`${idx}-${optionIndex}`}
                style={[
                  styles.optionCard,
                  round.options.length === 3 ? styles.optionCardWide : null,
                  isCorrect ? styles.optionCardCorrect : null,
                  isWrong ? styles.optionCardWrong : null,
                  dim ? styles.optionCardDim : null
                ]}
                onPress={() => handlePick(optionIndex)}
                disabled={pick !== null}
              >
                <Text style={targetIsHebrew ? styles.optionHebrew : styles.optionEnglish}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        {pick !== null ? (
          <View style={[styles.feedbackCard, pick === round.correct ? styles.feedbackCardGood : styles.feedbackCardBad]}>
            <View style={styles.feedbackTopRow}>
              <Text style={[styles.feedbackEyebrow, pick === round.correct ? styles.feedbackEyebrowGood : styles.feedbackEyebrowBad]}>
                {pick === round.correct ? `CORRECT · +${earnedPoints}` : "NOT QUITE"}
              </Text>
              <Text style={fromHebrew ? styles.feedbackAnswerEnglish : styles.feedbackAnswerHebrew}>{round.target}</Text>
            </View>
            <Text style={styles.feedbackNote}>{round.note}</Text>
          </View>
        ) : (
          <Text style={styles.tapHint}>TAP THE RIGHT TRANSLATION</Text>
        )}
      </ScrollView>

      <View style={styles.bottomCtaWrap}>
        {pick !== null ? (
          <Pressable style={styles.primaryButtonPurple} onPress={nextRound}>
            <Text style={styles.primaryButtonPurpleText}>{idx + 1 >= ROUNDS.length ? "See results" : "Next word"}</Text>
            <Text style={styles.primaryButtonPurpleText}>→</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function RuleRow({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.ruleRow}>
      <Text style={styles.ruleTitle}>{title}</Text>
      <Text style={styles.ruleBody}>{body}</Text>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statCellValue}>{value}</Text>
      <Text style={styles.statCellLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  introScreen: {
    flex: 1,
    backgroundColor: ACCENT
  },
  introTopBar: {
    paddingHorizontal: 18,
    paddingTop: 8
  },
  introScroll: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12
  },
  introWatermark: {
    position: "absolute",
    right: -12,
    top: -56,
    fontSize: 240,
    lineHeight: 240,
    color: "rgba(244,236,222,0.08)",
    fontWeight: "700"
  },
  closePillDark: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(244,236,222,0.18)"
  },
  closePillDarkText: {
    color: colors.bone,
    fontSize: 20,
    lineHeight: 20
  },
  closePillLight: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper
  },
  closePillLightText: {
    color: colors.ink,
    fontSize: 20,
    lineHeight: 20
  },
  introHebrew: {
    color: colors.bone,
    fontSize: 42,
    fontWeight: "700",
    marginTop: 42
  },
  introTitle: {
    color: colors.bone,
    fontSize: 40,
    lineHeight: 42,
    marginTop: 10
  },
  introTitleItalic: {
    fontStyle: "italic"
  },
  introCopy: {
    color: "rgba(244,236,222,0.78)",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    maxWidth: 320
  },
  introStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22
  },
  introStatCard: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(244,236,222,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  introStatLabel: {
    color: "rgba(244,236,222,0.62)",
    fontSize: 10,
    letterSpacing: 1.6
  },
  introStatValue: {
    color: colors.bone,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 6
  },
  rulesCard: {
    borderRadius: 24,
    backgroundColor: "rgba(244,236,222,0.12)",
    padding: 18,
    marginTop: 18,
    gap: 14
  },
  ruleRow: {
    gap: 4
  },
  ruleTitle: {
    color: colors.bone,
    fontSize: 15,
    fontWeight: "600"
  },
  ruleBody: {
    color: "rgba(244,236,222,0.75)",
    fontSize: 13.5,
    lineHeight: 19
  },
  playScreen: {
    flex: 1,
    backgroundColor: colors.bone
  },
  playHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10
  },
  playHeaderCenter: {
    flex: 1
  },
  playRound: {
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 1.3,
    marginBottom: 8
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(26,20,16,0.08)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: ACCENT
  },
  scoreBadge: {
    minWidth: 58,
    height: 36,
    borderRadius: 999,
    backgroundColor: "rgba(91,75,138,0.1)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  scoreBadgeLabel: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: "700"
  },
  playScroll: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 12
  },
  translateTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 14
  },
  translateEyebrow: {
    color: ACCENT,
    fontSize: 11,
    letterSpacing: 1.8
  },
  directionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(91,75,138,0.1)"
  },
  directionText: {
    color: ACCENT,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4
  },
  directionArrow: {
    color: ACCENT,
    fontSize: 12
  },
  streakPill: {
    minWidth: 34,
    height: 28,
    borderRadius: 999,
    backgroundColor: "rgba(91,75,138,0.12)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  streakPillText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: "700"
  },
  streakPillGhost: {
    width: 34
  },
  sourceCard: {
    minHeight: 178,
    borderRadius: 24,
    backgroundColor: colors.ink,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 28
  },
  sourceWatermark: {
    position: "absolute",
    right: -10,
    top: -40,
    fontSize: 210,
    lineHeight: 210,
    color: "rgba(244,236,222,0.05)"
  },
  sourceLabel: {
    color: "rgba(244,236,222,0.5)",
    fontSize: 10,
    letterSpacing: 1.8,
    marginBottom: 12
  },
  sourceHebrew: {
    color: colors.bone,
    fontSize: 48,
    fontWeight: "700",
    lineHeight: 54,
    textAlign: "center"
  },
  sourceEnglish: {
    color: colors.bone,
    fontSize: 44,
    lineHeight: 48,
    textAlign: "center",
    fontStyle: "italic"
  },
  sourceLatin: {
    color: "rgba(244,236,222,0.45)",
    fontSize: 11,
    letterSpacing: 1.5,
    marginTop: 10
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16
  },
  optionsGridSingle: {
    flexDirection: "column"
  },
  optionCard: {
    width: "48.5%",
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 16
  },
  optionCardWide: {
    width: "100%"
  },
  optionCardCorrect: {
    backgroundColor: colors.olive,
    borderColor: colors.olive
  },
  optionCardWrong: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta
  },
  optionCardDim: {
    opacity: 0.35
  },
  optionHebrew: {
    color: colors.ink,
    fontSize: 22,
    textAlign: "center"
  },
  optionEnglish: {
    color: colors.ink,
    fontSize: 20,
    textAlign: "center",
    fontStyle: "italic"
  },
  feedbackCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
    borderWidth: 1
  },
  feedbackCardGood: {
    backgroundColor: "rgba(107,122,69,0.08)",
    borderColor: "rgba(107,122,69,0.28)"
  },
  feedbackCardBad: {
    backgroundColor: "rgba(184,70,44,0.06)",
    borderColor: "rgba(184,70,44,0.22)"
  },
  feedbackTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8
  },
  feedbackEyebrow: {
    fontSize: 11,
    letterSpacing: 1.4
  },
  feedbackEyebrowGood: {
    color: colors.olive
  },
  feedbackEyebrowBad: {
    color: colors.terracotta
  },
  feedbackAnswerHebrew: {
    color: colors.olive,
    fontSize: 18,
    fontWeight: "700"
  },
  feedbackAnswerEnglish: {
    color: colors.olive,
    fontSize: 16,
    fontWeight: "600",
    fontStyle: "italic"
  },
  feedbackNote: {
    color: colors.inkMute,
    fontSize: 13.5,
    lineHeight: 20
  },
  tapHint: {
    textAlign: "center",
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 1.4,
    marginTop: 18
  },
  bottomCtaWrap: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 22
  },
  primaryButtonPurple: {
    minHeight: 52,
    borderRadius: radii.pill,
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  primaryButtonPurpleText: {
    color: colors.bone,
    fontSize: 15,
    fontWeight: "600"
  },
  resultsScreen: {
    flex: 1,
    backgroundColor: colors.bone
  },
  resultsTopBar: {
    paddingHorizontal: 18,
    paddingTop: 8
  },
  resultsScroll: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    alignItems: "center"
  },
  resultsEyebrow: {
    color: ACCENT,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 6
  },
  resultsTitle: {
    color: colors.ink,
    fontSize: 38,
    lineHeight: 40,
    textAlign: "center"
  },
  resultsHebrew: {
    color: colors.inkMute,
    fontSize: 22,
    marginTop: 8
  },
  scoreRing: {
    width: 182,
    height: 182,
    borderRadius: 91,
    borderWidth: 8,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24
  },
  scoreRingValue: {
    color: colors.ink,
    fontSize: 48,
    fontWeight: "700"
  },
  scoreRingLabel: {
    color: colors.inkMute,
    fontSize: 10,
    letterSpacing: 1.6,
    marginTop: 4
  },
  resultsStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24
  },
  statCell: {
    flex: 1,
    minWidth: 96,
    borderRadius: 16,
    backgroundColor: colors.paper,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center"
  },
  statCellValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "700"
  },
  statCellLabel: {
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 4
  },
  resultsReward: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: colors.ink,
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  resultsRewardDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.gold
  },
  resultsRewardBody: {
    flex: 1
  },
  resultsRewardTitle: {
    color: colors.bone,
    fontSize: 13,
    fontWeight: "600"
  },
  resultsRewardCopy: {
    color: "rgba(244,236,222,0.62)",
    fontSize: 11.5,
    marginTop: 2
  },
  resultsActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 22
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600"
  }
});
