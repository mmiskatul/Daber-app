import React from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii } from "./theme";

type GameId = "tf" | "echo" | "verbs" | "words";

type Props = {
  gameId: GameId;
  onExit: () => void;
};

type IntroMeta = {
  he: string;
  titleA: string;
  titleB: string;
  sub: string;
  desc: string;
  length: string;
  duration: string;
  color: string;
  rules: Array<{ title: string; body: string }>;
};

const INTRO_META: Record<GameId, IntroMeta> = {
  tf: {
    he: "נָכוֹן אוֹ לֹא",
    titleA: "True",
    titleB: "or false?",
    sub: "10 sentences. 30 seconds each.",
    desc: "Read a Hebrew sentence and decide if it is true. Faster correct answers are worth more once your streak starts to build.",
    length: "5 sentences",
    duration: "≈ 2 min",
    color: colors.terracotta,
    rules: [
      { title: "30-second clock", body: "Each sentence has a hard timer. If it hits zero, that round is gone." },
      { title: "Translate on demand", body: "You can reveal the English line before answering if needed." },
      { title: "Streak bonus", body: "Correct answers build momentum and make the run feel faster." }
    ]
  },
  echo: {
    he: "הֵד",
    titleA: "Hear it,",
    titleB: "echo it.",
    sub: "Hear it. Repeat it. Score it.",
    desc: "Dana gives you a short phrase. You repeat it and get soft per-word feedback instead of a harsh pass or fail.",
    length: "5 phrases",
    duration: "≈ 3 min",
    color: colors.olive,
    rules: [
      { title: "Listen first", body: "Replay the phrase as many times as you need before you answer." },
      { title: "Tap to record", body: "Start the attempt, wait through the listening state, then record your repeat." },
      { title: "Per-word score", body: "Each word comes back as nailed, close, or retry." }
    ]
  },
  verbs: {
    he: "פֹּעַל",
    titleA: "Match",
    titleB: "the verb.",
    sub: "Match conjugations under pressure.",
    desc: "A tense, subject, and prompt appear together. Pick the right conjugation before the timer drains.",
    length: "5 verbs",
    duration: "≈ 2 min",
    color: colors.gold,
    rules: [
      { title: "8-second clock", body: "Every round is fast. Read the subject before you tap." },
      { title: "No second tries", body: "One choice only. Wrong answers reveal the correct conjugation." },
      { title: "Multiplier chain", body: "Correct answers build a multiplier up to four times." }
    ]
  },
  words: {
    he: "מִלָּה",
    titleA: "Catch",
    titleB: "the word.",
    sub: "Fill in the missing word in the sentence.",
    desc: "A sentence appears with one missing piece. Pick the word that makes the Hebrew line work.",
    length: "5 sentences",
    duration: "≈ 3 min",
    color: "#7BABC0",
    rules: [
      { title: "Read the gap", body: "Use the sentence around the blank before you look at the choices." },
      { title: "Pick one chip", body: "One tap fills the gap and locks the round." },
      { title: "Hint costs points", body: "You can reveal a hint, but the round becomes worth less." }
    ]
  }
};

const TF_ROUNDS = [
  { he: "תֵּל אָבִיב נִמְצֵאת עַל הַיָּם.", en: "Tel Aviv is on the sea.", answer: true, explain: "Yes. Tel Aviv sits on the Mediterranean coast." },
  { he: "יוֹם שִׁשִּׁי בָּא אַחֲרֵי שַׁבָּת.", en: "Friday comes after Saturday.", answer: false, explain: "Friday comes before Shabbat, not after it." },
  { he: "חוּמוּס עָשׂוּי מֵחִמְצָה.", en: "Hummus is made from chickpeas.", answer: true, explain: "Correct. Hummus is built from chickpeas." },
  { he: "הָאֵם שֶׁל אַבָּא הִיא דּוֹדָה.", en: "Dad's mother is an aunt.", answer: false, explain: "That would be a grandmother, not an aunt." },
  { he: "בְּיִשְׂרָאֵל מְדַבְּרִים עִבְרִית.", en: "In Israel people speak Hebrew.", answer: true, explain: "Yes. Hebrew is the main shared public language." }
];

const ECHO_PHRASES = [
  { he: "שָׁלוֹם, מָה הַשָּׁעָה?", en: "Hello, what time is it?", words: ["שָׁלוֹם", "מָה", "הַשָּׁעָה"], pattern: ["good", "okay", "good"] as const },
  { he: "אֲנִי גָּר בְּתֵל אָבִיב.", en: "I live in Tel Aviv.", words: ["אֲנִי", "גָּר", "בְּתֵל", "אָבִיב"], pattern: ["good", "good", "okay", "good"] as const },
  { he: "תּוֹדָה רַבָּה לְךָ.", en: "Thank you very much.", words: ["תּוֹדָה", "רַבָּה", "לְךָ"], pattern: ["good", "good", "good"] as const },
  { he: "אֵיפֹה הַשֵּׁרוּתִים?", en: "Where is the restroom?", words: ["אֵיפֹה", "הַשֵּׁרוּתִים"], pattern: ["okay", "retry"] as const },
  { he: "בְּכַמָּה זֶה עוֹלֶה?", en: "How much does this cost?", words: ["בְּכַמָּה", "זֶה", "עוֹלֶה"], pattern: ["good", "good", "okay"] as const }
];

const VERB_ROUNDS = [
  { root: "הָלַךְ", tense: "present", subject: { he: "הִיא", en: "she" }, prompt: "She walks", options: ["הוֹלֵךְ", "הוֹלֶכֶת", "הוֹלְכוֹת", "הוֹלְכִים"], correct: 1, why: "Present, third person feminine singular." },
  { root: "אָכַל", tense: "past", subject: { he: "אֲנִי", en: "I (m.)" }, prompt: "I ate", options: ["אָכַלְתִּי", "אָכַלְתָּ", "אָכַל", "אָכְלוּ"], correct: 0, why: "Past, first person singular." },
  { root: "כָּתַב", tense: "future", subject: { he: "אַתָּה", en: "you (m.)" }, prompt: "You will write", options: ["יִכְתֹּב", "תִּכְתְּבִי", "תִּכְתֹּב", "יִכְתְּבוּ"], correct: 2, why: "Future, second person masculine singular." },
  { root: "שָׁתָה", tense: "present", subject: { he: "הֵם", en: "they (m.)" }, prompt: "They drink", options: ["שׁוֹתֶה", "שׁוֹתִים", "שׁוֹתָה", "שׁוֹתוֹת"], correct: 1, why: "Present, masculine plural." },
  { root: "דִּבֵּר", tense: "past", subject: { he: "הֵן", en: "they (f.)" }, prompt: "They spoke", options: ["דִּבְּרוּ", "דִּבְּרָה", "דִּבַּרְתֶּן", "דִּבְּרָה"], correct: 0, why: "Past plural form." }
];

const WORD_ROUNDS = [
  {
    sentence: ["אֲנִי", "___", "אֶת", "הָאֹכֶל"],
    target: "אוֹהֵב",
    options: ["אוֹהֵב", "אוֹכֵל", "אוֹמֵר", "אוֹסֵף"],
    en: "I love the food.",
    hint: "Think of the verb for affection, not eating.",
    why: "אוֹהֵב means love. The others mean eat, say, and gather."
  },
  {
    sentence: ["הוּא", "גָּר", "___", "הָעִיר"],
    target: "בְּ",
    options: ["בְּ", "עַל", "אֶת", "לְ"],
    en: "He lives in the city.",
    hint: "Use the short preposition for “in.”",
    why: "בְּ marks “in.” The other choices point elsewhere."
  },
  {
    sentence: ["___", "אַתָּה", "גָּר?"],
    target: "אֵיפֹה",
    options: ["מָה", "מִי", "אֵיפֹה", "מָתַי"],
    en: "Where do you live?",
    hint: "This asks about place, not person or time.",
    why: "אֵיפֹה means where."
  },
  {
    sentence: ["הִיא", "רוֹצָה", "לִשְׁתּוֹת", "___"],
    target: "מַיִם",
    options: ["לֶחֶם", "מַיִם", "חָלָב", "בָּשָׂר"],
    en: "She wants to drink water.",
    hint: "Choose the most basic drink.",
    why: "מַיִם is water."
  },
  {
    sentence: ["הַחָתוּל", "___", "עַל", "הַשֻּׁלְחָן"],
    target: "יוֹשֵׁב",
    options: ["רָץ", "הוֹלֵךְ", "יוֹשֵׁב", "יָשֵׁן"],
    en: "The cat sits on the table.",
    hint: "The cat is positioned there, not moving.",
    why: "יוֹשֵׁב means sits."
  }
];

export function GuidedGamesScreen({ gameId, onExit }: Props) {
  switch (gameId) {
    case "tf":
      return <TrueFalseGame onExit={onExit} />;
    case "echo":
      return <EchoGame onExit={onExit} />;
    case "verbs":
      return <VerbMatchGame onExit={onExit} />;
    case "words":
      return <WordPickGame onExit={onExit} />;
    default:
      return null;
  }
}

function TrueFalseGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = React.useState<"intro" | "playing" | "done">("intro");
  const [idx, setIdx] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [correct, setCorrect] = React.useState(0);
  const [streak, setStreak] = React.useState(0);
  const [bestStreak, setBestStreak] = React.useState(0);
  const [feedback, setFeedback] = React.useState<null | { answer: boolean | null; correct: boolean; round: (typeof TF_ROUNDS)[number] }>(null);
  const [showTrans, setShowTrans] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState(30);

  React.useEffect(() => {
    if (phase !== "playing" || feedback) {
      return;
    }
    if (timeLeft <= 0) {
      handleAnswer(null);
      return;
    }
    const t = setTimeout(() => setTimeLeft((value) => value - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, feedback]);

  React.useEffect(() => {
    if (phase === "playing") {
      setTimeLeft(30);
      setShowTrans(false);
    }
  }, [idx, phase]);

  function start() {
    setPhase("playing");
    setIdx(0);
    setScore(0);
    setCorrect(0);
    setStreak(0);
    setBestStreak(0);
    setFeedback(null);
    setShowTrans(false);
    setTimeLeft(30);
  }

  function handleAnswer(answer: boolean | null) {
    const round = TF_ROUNDS[idx];
    const isCorrect = answer === round.answer;
    setFeedback({ answer, correct: isCorrect, round });
    if (isCorrect) {
      const pts = 10 + streak * 5;
      setScore((value) => value + pts);
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

  function next() {
    setFeedback(null);
    if (idx + 1 >= TF_ROUNDS.length) {
      setPhase("done");
      return;
    }
    setIdx((value) => value + 1);
  }

  if (phase === "intro") {
    return <GameIntroShell gameId="tf" onExit={onExit} onStart={start} />;
  }

  if (phase === "done") {
    return <GameResultsShell gameId="tf" score={score} correct={correct} total={TF_ROUNDS.length} extra={`×${Math.max(bestStreak, 1)}`} extraLabel="Streak" onExit={onExit} onReplay={start} />;
  }

  const round = TF_ROUNDS[idx];

  return (
    <GameShell onExit={onExit} score={score} round={idx + 1} total={TF_ROUNDS.length} accent={colors.terracotta} timer={timeLeft}>
      <Text style={[styles.labelMono, { color: colors.terracotta }]}>TRUE OR FALSE</Text>
      {streak >= 2 ? (
        <View style={[styles.smallPill, { backgroundColor: "rgba(184,70,44,0.12)" }]}>
          <Text style={[styles.smallPillText, { color: colors.terracotta }]}>{streak} STREAK</Text>
        </View>
      ) : null}

      <View style={styles.paperCard}>
        <Text style={styles.cardWatermark}>?</Text>
        <Text style={styles.heSentence}>{round.he}</Text>
        {showTrans ? <Text style={styles.translationLine}>"{round.en}"</Text> : null}
        <View style={styles.tinyButtonRow}>
          <Pressable style={styles.tinyButton}>
            <Text style={styles.tinyButtonText}>▶</Text>
          </Pressable>
          <Pressable style={[styles.tinyButton, showTrans ? styles.tinyButtonActive : null]} onPress={() => setShowTrans((value) => !value)}>
            <Text style={styles.tinyButtonText}>文</Text>
          </Pressable>
        </View>
      </View>

      {feedback ? (
        <View style={[styles.feedbackCard, feedback.correct ? styles.feedbackGood : styles.feedbackBad]}>
          <Text style={[styles.feedbackTag, feedback.correct ? styles.feedbackTagGood : styles.feedbackTagBad]}>
            {feedback.answer === null ? "TIME UP" : feedback.correct ? `CORRECT · +${10 + (streak - 1) * 5}` : "NOT QUITE"}
          </Text>
          <Text style={styles.feedbackBody}>{feedback.round.explain}</Text>
          <Pressable style={[styles.primaryButton, { backgroundColor: colors.ink, marginTop: 12 }]} onPress={next}>
            <Text style={styles.primaryButtonText}>{idx + 1 >= TF_ROUNDS.length ? "See results" : "Next sentence"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.dualActionRow}>
          <Pressable style={[styles.answerCard, { backgroundColor: colors.ink }]} onPress={() => handleAnswer(false)}>
            <Text style={styles.answerCardIcon}>✕</Text>
            <Text style={styles.answerCardLabel}>FALSE</Text>
            <Text style={styles.answerCardHebrew}>לֹא</Text>
          </Pressable>
          <Pressable style={[styles.answerCard, { backgroundColor: colors.terracotta }]} onPress={() => handleAnswer(true)}>
            <Text style={styles.answerCardIcon}>✓</Text>
            <Text style={styles.answerCardLabel}>TRUE</Text>
            <Text style={styles.answerCardHebrew}>נָכוֹן</Text>
          </Pressable>
        </View>
      )}
    </GameShell>
  );
}

function EchoGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = React.useState<"intro" | "playing" | "done">("intro");
  const [step, setStep] = React.useState<"listen" | "yourTurn" | "recording" | "result">("listen");
  const [idx, setIdx] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [correct, setCorrect] = React.useState(0);
  const [wordScores, setWordScores] = React.useState<Array<{ word: string; tier: "good" | "okay" | "retry" }> | null>(null);

  React.useEffect(() => {
    if (phase !== "playing") {
      return;
    }
    if (step === "listen") {
      const t = setTimeout(() => setStep("yourTurn"), 1800);
      return () => clearTimeout(t);
    }
    return;
  }, [phase, step, idx]);

  function start() {
    setPhase("playing");
    setStep("listen");
    setIdx(0);
    setScore(0);
    setCorrect(0);
    setWordScores(null);
  }

  function startRecord() {
    setStep("recording");
    setTimeout(() => {
      const phrase = ECHO_PHRASES[idx];
      const nextScores = phrase.words.map((word, i) => ({ word, tier: phrase.pattern[i] || "good" }));
      setWordScores(nextScores);
      const pts = Math.round(nextScores.reduce((sum, item) => sum + (item.tier === "good" ? 100 : item.tier === "okay" ? 60 : 25), 0) / nextScores.length);
      setScore((value) => value + pts);
      if (nextScores.every((item) => item.tier === "good" || item.tier === "okay")) {
        setCorrect((value) => value + 1);
      }
      setStep("result");
    }, 1700);
  }

  function next() {
    setWordScores(null);
    setStep("listen");
    if (idx + 1 >= ECHO_PHRASES.length) {
      setPhase("done");
      return;
    }
    setIdx((value) => value + 1);
  }

  if (phase === "intro") {
    return <GameIntroShell gameId="echo" onExit={onExit} onStart={start} />;
  }

  if (phase === "done") {
    return <GameResultsShell gameId="echo" score={score} correct={correct} total={ECHO_PHRASES.length} onExit={onExit} onReplay={start} />;
  }

  const phrase = ECHO_PHRASES[idx];

  return (
    <GameShell onExit={onExit} score={score} round={idx + 1} total={ECHO_PHRASES.length} accent={colors.olive}>
      <Text style={[styles.labelMonoCenter, { color: colors.olive }]}>
        {step === "listen" ? "DANA SPEAKS" : step === "yourTurn" ? "YOUR TURN" : step === "recording" ? "LISTENING..." : "YOUR ATTEMPT"}
      </Text>

      <View style={styles.darkPhraseCard}>
        <View style={styles.speakerRow}>
          <Text style={styles.speakerName}>DANA</Text>
          <WaveformBars active={step === "listen"} color={colors.gold} />
        </View>
        <Text style={styles.heSentence}>
          {wordScores
            ? wordScores.map((item) => item.word).join(" ")
            : phrase.he}
        </Text>
        <Text style={styles.phraseTranslation}>"{phrase.en}"</Text>
      </View>

      {step === "recording" ? (
        <View style={styles.recordingWaveWrap}>
          {Array.from({ length: 20 }).map((_, index) => (
            <View key={index} style={[styles.recordingBar, { height: 14 + (index % 5) * 6 }]} />
          ))}
        </View>
      ) : null}

      {step === "result" && wordScores ? (
        <View style={styles.wordScoresList}>
          {wordScores.map((item) => (
            <View key={item.word} style={[styles.wordScoreRow, item.tier === "good" ? styles.wordScoreGood : item.tier === "okay" ? styles.wordScoreOkay : styles.wordScoreRetry]}>
              <View style={[styles.wordScoreDot, { backgroundColor: item.tier === "good" ? colors.olive : item.tier === "okay" ? colors.gold : colors.terracotta }]} />
              <Text style={styles.wordScoreWord}>{item.word}</Text>
              <Text style={[styles.wordScoreTag, { color: item.tier === "good" ? colors.olive : item.tier === "okay" ? colors.gold : colors.terracotta }]}>
                {item.tier === "good" ? "NAILED" : item.tier === "okay" ? "CLOSE" : "RETRY"}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.bottomArea}>
        {step === "listen" ? (
          <View style={styles.bottomDualButtons}>
            <Pressable style={styles.secondaryButtonWide}>
              <Text style={styles.secondaryButtonText}>Play again</Text>
            </Pressable>
            <Pressable style={[styles.primaryButtonFlex, { backgroundColor: colors.olive }]} onPress={() => setStep("yourTurn")}>
              <Text style={styles.primaryButtonText}>I'm ready</Text>
            </Pressable>
          </View>
        ) : null}
        {step === "yourTurn" ? (
          <View style={styles.micWrap}>
            <Pressable style={[styles.micButton, { backgroundColor: colors.olive }]} onPress={startRecord}>
              <Text style={styles.micButtonIcon}>●</Text>
            </Pressable>
            <Text style={styles.micHint}>Tap and repeat the phrase</Text>
          </View>
        ) : null}
        {step === "recording" ? (
          <View style={styles.micWrap}>
            <View style={[styles.micButton, { backgroundColor: colors.terracotta }]}>
              <Text style={styles.micButtonIcon}>●</Text>
            </View>
            <Text style={[styles.micHint, { color: colors.terracotta }]}>LISTENING</Text>
          </View>
        ) : null}
        {step === "result" ? (
          <View style={styles.bottomDualButtons}>
            <Pressable style={styles.secondaryButtonWide} onPress={() => { setWordScores(null); setStep("yourTurn"); }}>
              <Text style={styles.secondaryButtonText}>Try again</Text>
            </Pressable>
            <Pressable style={[styles.primaryButtonFlex, { backgroundColor: colors.olive }]} onPress={next}>
              <Text style={styles.primaryButtonText}>{idx + 1 >= ECHO_PHRASES.length ? "Results" : "Next"}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </GameShell>
  );
}

function VerbMatchGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = React.useState<"intro" | "playing" | "done">("intro");
  const [idx, setIdx] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [correct, setCorrect] = React.useState(0);
  const [mult, setMult] = React.useState(1);
  const [pick, setPick] = React.useState<number | null>(null);
  const [timeLeft, setTimeLeft] = React.useState(8);

  React.useEffect(() => {
    if (phase !== "playing" || pick !== null) {
      return;
    }
    if (timeLeft <= 0) {
      handlePick(-1);
      return;
    }
    const t = setTimeout(() => setTimeLeft((value) => value - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, pick]);

  React.useEffect(() => {
    if (phase === "playing") {
      setTimeLeft(8);
    }
  }, [idx, phase]);

  function start() {
    setPhase("playing");
    setIdx(0);
    setScore(0);
    setCorrect(0);
    setMult(1);
    setPick(null);
    setTimeLeft(8);
  }

  function handlePick(choice: number) {
    const round = VERB_ROUNDS[idx];
    setPick(choice);
    if (choice === round.correct) {
      const pts = 10 * mult;
      setScore((value) => value + pts);
      setCorrect((value) => value + 1);
      setMult((value) => Math.min(value + 1, 4));
    } else {
      setMult(1);
    }
  }

  function next() {
    setPick(null);
    if (idx + 1 >= VERB_ROUNDS.length) {
      setPhase("done");
      return;
    }
    setIdx((value) => value + 1);
  }

  if (phase === "intro") {
    return <GameIntroShell gameId="verbs" onExit={onExit} onStart={start} />;
  }

  if (phase === "done") {
    return <GameResultsShell gameId="verbs" score={score} correct={correct} total={VERB_ROUNDS.length} extra={`×${mult}`} extraLabel="Mult" onExit={onExit} onReplay={start} />;
  }

  const round = VERB_ROUNDS[idx];

  return (
    <GameShell onExit={onExit} score={score} round={idx + 1} total={VERB_ROUNDS.length} accent={colors.gold} timer={timeLeft} multiplier={mult > 1 ? mult : undefined}>
      <Text style={[styles.labelMonoCenter, { color: "#A57721" }]}>CONJUGATE THE VERB</Text>

      <View style={styles.darkPromptCard}>
        <Text style={styles.darkCardWatermark}>{round.root.charAt(0)}</Text>
        <Text style={styles.promptMeta}>ROOT · {round.tense.toUpperCase()}</Text>
        <Text style={styles.promptRoot}>{round.root}</Text>
        <View style={styles.subjectPill}>
          <Text style={styles.subjectHebrew}>{round.subject.he}</Text>
          <Text style={styles.subjectPrompt}>"{round.prompt}"</Text>
        </View>
      </View>

      <View style={styles.optionMatrix}>
        {round.options.map((option, index) => {
          const isCorrect = pick !== null && index === round.correct;
          const isWrong = pick === index && index !== round.correct;
          const dim = pick !== null && !isCorrect && !isWrong;
          return (
            <Pressable
              key={`${round.root}-${index}`}
              style={[
                styles.matrixOption,
                isCorrect ? styles.optionCardCorrect : null,
                isWrong ? styles.optionCardWrong : null,
                dim ? styles.optionCardDim : null
              ]}
              disabled={pick !== null}
              onPress={() => handlePick(index)}
            >
              <Text style={styles.optionHebrew}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      {pick !== null ? (
        <View style={[styles.feedbackCard, pick === round.correct ? styles.feedbackGood : styles.feedbackBad]}>
          <Text style={[styles.feedbackTag, pick === round.correct ? styles.feedbackTagGood : styles.feedbackTagBad]}>
            {pick === -1 ? "TIME UP" : pick === round.correct ? `CORRECT · +${10 * mult}` : "NOT QUITE"}
          </Text>
          <Text style={styles.feedbackAnswer}>{round.options[round.correct]}</Text>
          <Text style={styles.feedbackBody}>{round.why}</Text>
          <Pressable style={[styles.primaryButton, { backgroundColor: colors.gold, marginTop: 12 }]} onPress={next}>
            <Text style={[styles.primaryButtonText, { color: colors.ink }]}>{idx + 1 >= VERB_ROUNDS.length ? "See results" : "Next verb"}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.tapHint}>TAP THE RIGHT CONJUGATION</Text>
      )}
    </GameShell>
  );
}

function WordPickGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = React.useState<"intro" | "playing" | "done">("intro");
  const [idx, setIdx] = React.useState(0);
  const [score, setScore] = React.useState(0);
  const [correct, setCorrect] = React.useState(0);
  const [pick, setPick] = React.useState<string | null>(null);
  const [showHint, setShowHint] = React.useState(false);

  React.useEffect(() => {
    setPick(null);
    setShowHint(false);
  }, [idx]);

  function start() {
    setPhase("playing");
    setIdx(0);
    setScore(0);
    setCorrect(0);
    setPick(null);
    setShowHint(false);
  }

  function handlePick(option: string) {
    if (pick) {
      return;
    }
    setPick(option);
    if (option === WORD_ROUNDS[idx].target) {
      setScore((value) => value + (showHint ? 6 : 10));
      setCorrect((value) => value + 1);
    }
  }

  function next() {
    if (idx + 1 >= WORD_ROUNDS.length) {
      setPhase("done");
      return;
    }
    setIdx((value) => value + 1);
  }

  if (phase === "intro") {
    return <GameIntroShell gameId="words" onExit={onExit} onStart={start} />;
  }

  if (phase === "done") {
    return <GameResultsShell gameId="words" score={score} correct={correct} total={WORD_ROUNDS.length} onExit={onExit} onReplay={start} />;
  }

  const round = WORD_ROUNDS[idx];

  return (
    <GameShell onExit={onExit} score={score} round={idx + 1} total={WORD_ROUNDS.length} accent="#5B8696">
      <Text style={[styles.labelMonoCenter, { color: "#5B8696" }]}>FILL THE GAP</Text>

      <View style={styles.paperCard}>
        <Text style={styles.heSentenceGap}>
          {round.sentence.map((word, index) =>
            word === "___"
              ? ` ${pick || "____"} `
              : `${word}${index === round.sentence.length - 1 ? "" : " "}`
          ).join("")}
        </Text>
        <Text style={styles.translationLine}>"{round.en}"</Text>
      </View>

      {showHint && !pick ? (
        <View style={styles.hintCard}>
          <Text style={styles.hintBody}>{round.hint}</Text>
          <Text style={styles.hintPenalty}>-4 PTS</Text>
        </View>
      ) : null}

      <View style={styles.chipWrap}>
        {round.options.map((option) => {
          const isCorrect = pick !== null && option === round.target;
          const isWrong = pick === option && option !== round.target;
          const dim = pick !== null && !isCorrect && !isWrong;
          return (
            <Pressable
              key={option}
              style={[
                styles.wordChip,
                isCorrect ? styles.optionCardCorrect : null,
                isWrong ? styles.optionCardWrong : null,
                dim ? styles.optionCardDim : null
              ]}
              disabled={pick !== null}
              onPress={() => handlePick(option)}
            >
              <Text style={styles.wordChipText}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      {pick ? (
        <View style={[styles.feedbackCard, pick === round.target ? styles.feedbackGood : styles.feedbackBad]}>
          <Text style={[styles.feedbackTag, pick === round.target ? styles.feedbackTagGood : styles.feedbackTagBad]}>
            {pick === round.target ? `CORRECT · +${showHint ? 6 : 10}` : "NOT QUITE"}
          </Text>
          <Text style={styles.feedbackBody}>{round.why}</Text>
          <Pressable style={[styles.primaryButton, { backgroundColor: "#5B8696", marginTop: 12 }]} onPress={next}>
            <Text style={styles.primaryButtonText}>{idx + 1 >= WORD_ROUNDS.length ? "See results" : "Next word"}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.bottomDualButtons}>
          <Pressable style={styles.secondaryButtonWide} onPress={() => setShowHint(true)} disabled={showHint}>
            <Text style={[styles.secondaryButtonText, showHint ? styles.disabledText : null]}>Hint</Text>
          </Pressable>
          <View style={styles.tapHintBlock}>
            <Text style={styles.tapHint}>TAP A WORD</Text>
          </View>
        </View>
      )}
    </GameShell>
  );
}

function GameIntroShell({ gameId, onExit, onStart }: { gameId: GameId; onExit: () => void; onStart: () => void }) {
  const meta = INTRO_META[gameId];
  return (
    <SafeAreaView style={[styles.introScreen, { backgroundColor: meta.color }]}>
      <View style={styles.introTopBar}>
        <Pressable style={styles.closePillDark} onPress={onExit}>
          <Text style={styles.closePillDarkText}>×</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.introScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.introWatermark}>{meta.he.charAt(0)}</Text>
        <Text style={styles.introHebrew}>{meta.he}</Text>
        <Text style={styles.introTitle}>
          {meta.titleA}{"\n"}
          <Text style={styles.introTitleItalic}>{meta.titleB}</Text>
        </Text>
        <Text style={styles.introCopy}>{meta.desc}</Text>
        <View style={styles.introStatsRow}>
          <View style={styles.introStatCard}>
            <Text style={styles.introStatLabel}>LENGTH</Text>
            <Text style={styles.introStatValue}>{meta.length}</Text>
          </View>
          <View style={styles.introStatCard}>
            <Text style={styles.introStatLabel}>DURATION</Text>
            <Text style={styles.introStatValue}>{meta.duration}</Text>
          </View>
        </View>
        <View style={styles.rulesCard}>
          {meta.rules.map((rule) => (
            <View key={rule.title} style={styles.ruleRow}>
              <Text style={styles.ruleTitle}>{rule.title}</Text>
              <Text style={styles.ruleBody}>{rule.body}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.bottomCtaWrap}>
        <Pressable style={[styles.primaryButton, { backgroundColor: colors.ink }]} onPress={onStart}>
          <Text style={styles.primaryButtonText}>Start game</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function GameResultsShell({
  gameId,
  score,
  correct,
  total,
  extra,
  extraLabel,
  onReplay,
  onExit
}: {
  gameId: GameId;
  score: number;
  correct: number;
  total: number;
  extra?: string;
  extraLabel?: string;
  onReplay: () => void;
  onExit: () => void;
}) {
  const meta = INTRO_META[gameId];
  const pct = Math.round((correct / total) * 100);
  return (
    <SafeAreaView style={styles.resultsScreen}>
      <View style={styles.resultsTopBar}>
        <Pressable style={styles.closePillLight} onPress={onExit}>
          <Text style={styles.closePillLightText}>×</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.resultsScroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.resultsEyebrow, { color: meta.color }]}>SESSION COMPLETE</Text>
        <Text style={styles.resultsTitle}>{pct >= 80 ? "Strong run." : pct >= 50 ? "Keep going." : "Run it again."}</Text>
        <Text style={styles.resultsHebrew}>{meta.he}</Text>
        <View style={[styles.scoreRing, { borderColor: meta.color }]}>
          <Text style={styles.scoreRingValue}>{pct}%</Text>
          <Text style={styles.scoreRingLabel}>ACCURACY</Text>
        </View>
        <View style={styles.resultsStatsRow}>
          <StatCell label="Points" value={`+${score}`} />
          <StatCell label="Correct" value={`${correct}/${total}`} />
          <StatCell label={extraLabel || "XP"} value={extra || `+${Math.round(score * 1.2)}`} />
        </View>
      </ScrollView>
      <View style={styles.resultsActions}>
        <Pressable style={styles.secondaryButtonWide} onPress={onExit}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <Pressable style={[styles.primaryButtonFlex, { backgroundColor: meta.color }]} onPress={onReplay}>
          <Text style={styles.primaryButtonText}>Play again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function GameShell({
  onExit,
  score,
  round,
  total,
  accent,
  timer,
  multiplier,
  children
}: {
  onExit: () => void;
  score: number;
  round: number;
  total: number;
  accent: string;
  timer?: number;
  multiplier?: number;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.playScreen}>
      <View style={styles.playHeader}>
        <Pressable style={styles.closePillLight} onPress={onExit}>
          <Text style={styles.closePillLightText}>×</Text>
        </Pressable>
        <View style={styles.playHeaderCenter}>
          <Text style={styles.playRound}>Round {round}/{total}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(round / total) * 100}%`, backgroundColor: accent }]} />
          </View>
        </View>
        {timer !== undefined ? (
          <View style={[styles.timerBadge, timer <= 5 ? styles.timerBadgeDanger : null]}>
            <Text style={[styles.timerBadgeText, timer <= 5 ? styles.timerBadgeTextDanger : null]}>{timer}</Text>
          </View>
        ) : multiplier ? (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeLabel}>×{multiplier}</Text>
          </View>
        ) : (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeLabel}>+{score}</Text>
          </View>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.playScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreRowLabel}>Score</Text>
          <Text style={styles.scoreRowValue}>+{score}</Text>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function WaveformBars({ active, color }: { active: boolean; color: string }) {
  return (
    <View style={styles.waveformWrap}>
      {Array.from({ length: 9 }).map((_, index) => (
        <View key={index} style={[styles.waveBar, { backgroundColor: color, height: active ? 4 + (index % 3) * 5 : 2 }]} />
      ))}
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
  introScreen: { flex: 1 },
  introTopBar: { paddingHorizontal: 18, paddingTop: 8 },
  introScroll: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
  introWatermark: { position: "absolute", right: -12, top: -56, fontSize: 240, lineHeight: 240, color: "rgba(244,236,222,0.08)", fontWeight: "700" },
  closePillDark: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(244,236,222,0.18)" },
  closePillDarkText: { color: colors.bone, fontSize: 20, lineHeight: 20 },
  closePillLight: { width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  closePillLightText: { color: colors.ink, fontSize: 20, lineHeight: 20 },
  introHebrew: { color: colors.bone, fontSize: 42, fontWeight: "700", marginTop: 42 },
  introTitle: { color: colors.bone, fontSize: 40, lineHeight: 42, marginTop: 10 },
  introTitleItalic: { fontStyle: "italic" },
  introCopy: { color: "rgba(244,236,222,0.78)", fontSize: 15, lineHeight: 22, marginTop: 14, maxWidth: 320 },
  introStatsRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  introStatCard: { flex: 1, borderRadius: 18, backgroundColor: "rgba(244,236,222,0.12)", paddingHorizontal: 14, paddingVertical: 14 },
  introStatLabel: { color: "rgba(244,236,222,0.62)", fontSize: 10, letterSpacing: 1.6 },
  introStatValue: { color: colors.bone, fontSize: 16, fontWeight: "600", marginTop: 6 },
  rulesCard: { borderRadius: 24, backgroundColor: "rgba(244,236,222,0.12)", padding: 18, marginTop: 18, gap: 14 },
  ruleRow: { gap: 4 },
  ruleTitle: { color: colors.bone, fontSize: 15, fontWeight: "600" },
  ruleBody: { color: "rgba(244,236,222,0.75)", fontSize: 13.5, lineHeight: 19 },
  playScreen: { flex: 1, backgroundColor: colors.bone },
  playHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 },
  playHeaderCenter: { flex: 1 },
  playRound: { color: colors.inkMute, fontSize: 11, letterSpacing: 1.3, marginBottom: 8 },
  progressTrack: { height: 4, borderRadius: 999, backgroundColor: "rgba(26,20,16,0.08)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  timerBadge: { width: 42, height: 36, borderRadius: 999, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  timerBadgeDanger: { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
  timerBadgeText: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  timerBadgeTextDanger: { color: colors.terracotta },
  scoreBadge: { minWidth: 58, height: 36, borderRadius: 999, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  scoreBadgeLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  playScroll: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 22 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  scoreRowLabel: { color: colors.inkMute, fontSize: 11, letterSpacing: 1.3 },
  scoreRowValue: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  labelMono: { fontSize: 11, letterSpacing: 1.8, marginBottom: 12 },
  labelMonoCenter: { fontSize: 11, letterSpacing: 1.8, marginBottom: 12, textAlign: "center" },
  smallPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, marginBottom: 12 },
  smallPillText: { fontSize: 10, fontWeight: "700" },
  paperCard: { backgroundColor: colors.paper, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: colors.line, minHeight: 140, overflow: "hidden" },
  cardWatermark: { position: "absolute", right: -10, top: -44, fontSize: 180, color: "rgba(26,20,16,0.04)" },
  heSentence: { color: colors.ink, fontSize: 24, lineHeight: 38, textAlign: "right" },
  heSentenceGap: { color: colors.ink, fontSize: 22, lineHeight: 38, textAlign: "right" },
  translationLine: { color: colors.inkMute, fontSize: 13, marginTop: 14, fontStyle: "italic" },
  tinyButtonRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  tinyButton: { width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(26,20,16,0.06)" },
  tinyButtonActive: { backgroundColor: colors.gold },
  tinyButtonText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  dualActionRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  answerCard: { flex: 1, borderRadius: 18, paddingVertical: 18, alignItems: "center", justifyContent: "center", gap: 4 },
  answerCardIcon: { color: colors.bone, fontSize: 20, fontWeight: "700" },
  answerCardLabel: { color: colors.bone, fontSize: 13, fontWeight: "700", letterSpacing: 0.8 },
  answerCardHebrew: { color: "rgba(244,236,222,0.8)", fontSize: 16 },
  feedbackCard: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, marginTop: 16, borderWidth: 1 },
  feedbackGood: { backgroundColor: "rgba(107,122,69,0.08)", borderColor: "rgba(107,122,69,0.28)" },
  feedbackBad: { backgroundColor: "rgba(184,70,44,0.06)", borderColor: "rgba(184,70,44,0.22)" },
  feedbackTag: { fontSize: 11, letterSpacing: 1.3, marginBottom: 8 },
  feedbackTagGood: { color: colors.olive },
  feedbackTagBad: { color: colors.terracotta },
  feedbackBody: { color: colors.inkMute, fontSize: 13.5, lineHeight: 20 },
  feedbackAnswer: { color: colors.olive, fontSize: 18, fontWeight: "700", marginBottom: 6 },
  darkPhraseCard: { backgroundColor: colors.ink, borderRadius: 22, padding: 22, minHeight: 180 },
  speakerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  speakerName: { color: colors.gold, fontSize: 10, letterSpacing: 1.5 },
  waveformWrap: { flexDirection: "row", alignItems: "center", gap: 2, height: 16 },
  waveBar: { width: 2, borderRadius: 2 },
  phraseTranslation: { color: "rgba(244,236,222,0.55)", fontSize: 13, marginTop: 12, fontStyle: "italic" },
  recordingWaveWrap: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 4, height: 56, marginTop: 12 },
  recordingBar: { width: 3, borderRadius: 4, backgroundColor: colors.olive },
  wordScoresList: { gap: 6, marginTop: 14 },
  wordScoreRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  wordScoreGood: { backgroundColor: "rgba(107,122,69,0.1)" },
  wordScoreOkay: { backgroundColor: "rgba(217,163,94,0.14)" },
  wordScoreRetry: { backgroundColor: "rgba(184,70,44,0.08)" },
  wordScoreDot: { width: 8, height: 8, borderRadius: 999 },
  wordScoreWord: { flex: 1, color: colors.ink, fontSize: 18, textAlign: "right" },
  wordScoreTag: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  bottomArea: { marginTop: 16 },
  bottomDualButtons: { flexDirection: "row", gap: 10, marginTop: 12 },
  secondaryButtonWide: { flex: 1, minHeight: 50, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  primaryButtonFlex: { flex: 1.2, minHeight: 50, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  primaryButton: { minHeight: 50, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: colors.bone, fontSize: 14, fontWeight: "600" },
  micWrap: { alignItems: "center", gap: 8, marginTop: 10 },
  micButton: { width: 78, height: 78, borderRadius: 39, alignItems: "center", justifyContent: "center" },
  micButtonIcon: { color: colors.bone, fontSize: 20, fontWeight: "700" },
  micHint: { color: colors.inkMute, fontSize: 12 },
  darkPromptCard: { backgroundColor: colors.ink, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 22, minHeight: 150, alignItems: "center", overflow: "hidden" },
  darkCardWatermark: { position: "absolute", right: -14, top: -30, fontSize: 180, color: "rgba(244,236,222,0.06)" },
  promptMeta: { color: colors.gold, fontSize: 10, letterSpacing: 1.6, marginBottom: 6 },
  promptRoot: { color: colors.bone, fontSize: 34, fontWeight: "700", marginBottom: 12 },
  subjectPill: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(244,236,222,0.1)" },
  subjectHebrew: { color: colors.gold, fontSize: 17 },
  subjectPrompt: { color: "rgba(244,236,222,0.85)", fontSize: 13, fontStyle: "italic" },
  optionMatrix: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  matrixOption: { width: "48.5%", minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 18 },
  optionCardCorrect: { backgroundColor: colors.olive, borderColor: colors.olive },
  optionCardWrong: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  optionCardDim: { opacity: 0.4 },
  optionHebrew: { color: colors.ink, fontSize: 22, textAlign: "center" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  wordChip: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, paddingVertical: 12 },
  wordChipText: { color: colors.ink, fontSize: 20 },
  hintCard: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "space-between", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(217,163,94,0.15)", borderWidth: 1, borderColor: "rgba(217,163,94,0.4)", marginTop: 12 },
  hintBody: { flex: 1, color: colors.inkMute, fontSize: 12.5 },
  hintPenalty: { color: colors.gold, fontSize: 10, fontWeight: "700" },
  tapHint: { textAlign: "center", color: colors.inkMute, fontSize: 11, letterSpacing: 1.4 },
  tapHintBlock: { flex: 1.4, alignItems: "center", justifyContent: "center" },
  disabledText: { opacity: 0.45 },
  bottomCtaWrap: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 22 },
  resultsScreen: { flex: 1, backgroundColor: colors.bone },
  resultsTopBar: { paddingHorizontal: 18, paddingTop: 8 },
  resultsScroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, alignItems: "center" },
  resultsEyebrow: { fontSize: 11, letterSpacing: 2, marginBottom: 6 },
  resultsTitle: { color: colors.ink, fontSize: 38, lineHeight: 40, textAlign: "center" },
  resultsHebrew: { color: colors.inkMute, fontSize: 22, marginTop: 8 },
  scoreRing: { width: 182, height: 182, borderRadius: 91, borderWidth: 8, alignItems: "center", justifyContent: "center", marginTop: 24 },
  scoreRingValue: { color: colors.ink, fontSize: 48, fontWeight: "700" },
  scoreRingLabel: { color: colors.inkMute, fontSize: 10, letterSpacing: 1.6, marginTop: 4 },
  resultsStatsRow: { flexDirection: "row", gap: 8, marginTop: 24 },
  statCell: { flex: 1, minWidth: 96, borderRadius: 16, backgroundColor: colors.paper, paddingHorizontal: 14, paddingVertical: 16, alignItems: "center" },
  statCellValue: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  statCellLabel: { color: colors.inkMute, fontSize: 11, letterSpacing: 1.2, marginTop: 4 },
  resultsActions: { flexDirection: "row", gap: 10, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 22 }
});
