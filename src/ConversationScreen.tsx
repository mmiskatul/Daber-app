import React from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setIsAudioActiveAsync,
  setAudioModeAsync,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState
} from "expo-audio";
import * as Speech from "expo-speech";
import { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  getScenarioSession,
  launchScenario,
  ScenarioSessionResponse,
  ScenarioSpeechResponse,
  ScenarioTurn,
  sendScenarioMessage,
  sendScenarioVoice,
  synthesizeScenarioTutorSpeech,
  translateScenarioTurn,
  updateSupportLanguage
} from "./api";
import { firestore } from "./firebase";
import { colors, radii } from "./theme";

type Props = {
  user: User;
  sessionId: string;
  onReplaceSession: (sessionId: string) => void;
  onExit: () => void;
};

type Mode = "listening" | "thinking" | "speaking";

type PronunciationFeedback = NonNullable<ScenarioTurn["pronunciation"]>;
type LocalScenarioTurn = ScenarioTurn & {
  localId?: string;
  pending?: boolean;
};

type TranslationStatus = "generating" | "ready" | "cached";

type SupportLanguageConfig = {
  native: string;
  label: string;
  speechLanguage: string;
};

const SUPPORT_LANGUAGE_OPTIONS: SupportLanguageConfig[] = [
  { native: "English", label: "English", speechLanguage: "en-US" },
  { native: "EspaÃ±ol", label: "Spanish", speechLanguage: "es-ES" },
  { native: "FranÃ§ais", label: "French", speechLanguage: "fr-FR" },
  { native: "Ð ÑƒÑÑÐºÐ¸Ð¹", label: "Russian", speechLanguage: "ru-RU" },
  { native: "Other", label: "English", speechLanguage: "en-US" }
];

const NORMALIZED_SUPPORT_LANGUAGE_OPTIONS: SupportLanguageConfig[] = [
  { native: "English", label: "English", speechLanguage: "en-US" },
  { native: "Spanish", label: "Spanish", speechLanguage: "es-ES" },
  { native: "French", label: "French", speechLanguage: "fr-FR" },
  { native: "Russian", label: "Russian", speechLanguage: "ru-RU" },
  { native: "Other", label: "English", speechLanguage: "en-US" }
];

type VoiceDraft = {
  uri: string;
  mimeType: string;
  fileName: string;
};

type RequestMetrics = {
  lastResponseMs: number | null;
  lastInputMode: "voice" | "text" | null;
};

const VOICE_RECORDING_MAX_MS = 12000;

function formatSeconds(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatLatency(value: number | null): string {
  if (value === null) {
    return "--";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(1)} s`;
}

function stripNiqqud(s: string): string {
  return s.replace(/[\u0591-\u05BD\u05BF-\u05C2\u05C4-\u05C7]/g, '');
}

function isHebrewOnlyLearnerText(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed) {
    return false;
  }

  return !/[A-Za-z]/.test(trimmed) && /^[\u0590-\u05FF0-9\s.,!?'"():;+\-/%]+$/u.test(trimmed);
}

function getSupportLanguageConfig(nativeLanguage?: string | null): SupportLanguageConfig {
  const value = nativeLanguage || "";
  const matched =
    NORMALIZED_SUPPORT_LANGUAGE_OPTIONS.find((option) => option.native === value) ||
    (value.includes("Espa") ? NORMALIZED_SUPPORT_LANGUAGE_OPTIONS[1] : null) ||
    (value.includes("Fran") ? NORMALIZED_SUPPORT_LANGUAGE_OPTIONS[2] : null) ||
    (value.includes("Ñ") || value.includes("Ð") ? NORMALIZED_SUPPORT_LANGUAGE_OPTIONS[3] : null);

  return matched || NORMALIZED_SUPPORT_LANGUAGE_OPTIONS[0];
}

function getPronunciationIssue(feedback?: string): {
  label: string;
  hint: string;
  expectedSound: string;
  heardApproximation: string;
} {
  const clean = (feedback || "").trim();

  if (!clean) {
    return {
      label: "SOUND",
      hint: "tap to review this sound",
      expectedSound: "target sound",
      heardApproximation: "unclear"
    };
  }

  const parts = clean.split(":");
  if (parts.length > 1) {
    return {
      label: parts[0]?.trim().toUpperCase() || "SOUND",
      hint: parts.slice(1).join(":").trim() || "tap to review this sound",
      expectedSound: parts.slice(1).join(":").trim() || "target sound",
      heardApproximation: parts.slice(1).join(":").trim() || "unclear"
    };
  }

  const word = clean.split(/\s+/)[0] || "SOUND";
  return {
    label: word.replace(/[^A-Za-zא-ת]/g, "").toUpperCase() || "SOUND",
    hint: clean,
    expectedSound: clean,
    heardApproximation: "unclear"
  };
}

function formatSeverity(value?: "low" | "medium" | "high"): string {
  if (value === "high") {
    return "HIGH";
  }
  if (value === "low") {
    return "LOW";
  }
  return "MEDIUM";
}

function prioritizePronunciationIssues<T extends { label: string; severity?: "low" | "medium" | "high"; issueCount?: number }>(issues: T[]): T[] {
  return [...issues].sort((left, right) => {
    const leftTzadi = left.label === "TZADI" ? 1 : 0;
    const rightTzadi = right.label === "TZADI" ? 1 : 0;

    if (leftTzadi !== rightTzadi) {
      return rightTzadi - leftTzadi;
    }

    const severityRank = { high: 3, medium: 2, low: 1 } as const;
    const severityDelta = severityRank[right.severity || "medium"] - severityRank[left.severity || "medium"];

    if (severityDelta !== 0) {
      return severityDelta;
    }

    return (right.issueCount || 0) - (left.issueCount || 0);
  });
}

export function ConversationScreen({ user, sessionId, onReplaceSession, onExit }: Props) {
  const [session, setSession] = React.useState<ScenarioSessionResponse | null>(null);
  const [turns, setTurns] = React.useState<LocalScenarioTurn[]>([]);
  const [inputMode, setInputMode] = React.useState<"voice" | "text">("voice");
  const [textValue, setTextValue] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const [showHints, setShowHints] = React.useState(false);
  const [showCorrectionSheet, setShowCorrectionSheet] = React.useState(false);
  const [selectedCorrectionTurn, setSelectedCorrectionTurn] = React.useState<LocalScenarioTurn | null>(null);
  const [showSceneMenu, setShowSceneMenu] = React.useState(false);
  const [showSessionReview, setShowSessionReview] = React.useState(false);
  const [showTranslations, setShowTranslations] = React.useState<Record<number, boolean>>({});
  const [autoSpeakEnabled, setAutoSpeakEnabled] = React.useState(true);
  const [error, setError] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("speaking");
  const [recordingReady, setRecordingReady] = React.useState(false);
  const [voiceDraft, setVoiceDraft] = React.useState<VoiceDraft | null>(null);
  const [selectedSupportNative, setSelectedSupportNative] = React.useState("English");
  const [translationCache, setTranslationCache] = React.useState<Record<string, string>>({});
  const [translationStatus, setTranslationStatus] = React.useState<Record<string, TranslationStatus>>({});
  const [speechCache, setSpeechCache] = React.useState<Record<string, ScenarioSpeechResponse>>({});
  const [isFallbackTutorSpeaking, setIsFallbackTutorSpeaking] = React.useState(false);
  const [requestMetrics, setRequestMetrics] = React.useState<RequestMetrics>({
    lastResponseMs: null,
    lastInputMode: null
  });
  const lastSpokenTutorTurnRef = React.useRef("");
  const initialSnapshotSeenRef = React.useRef(false);
  const translationRequestCacheRef = React.useRef<Record<string, Promise<string>>>({});
  const speechRequestCacheRef = React.useRef<Record<string, Promise<ScenarioSpeechResponse>>>({});
  const voiceStopTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRecordingActiveRef = React.useRef(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const tutorPlayerRef = React.useRef(createAudioPlayer());
  const tutorPlayerStatus = useAudioPlayerStatus(tutorPlayerRef.current);
  const supportLanguage = getSupportLanguageConfig(selectedSupportNative);

  const clearVoiceStopTimer = React.useCallback(() => {
    if (voiceStopTimerRef.current) {
      clearTimeout(voiceStopTimerRef.current);
      voiceStopTimerRef.current = null;
    }
  }, []);

  const getTranslationCacheKey = React.useCallback((text: string, native: string) => `${native}::${text}`, []);
  const getSpeechCacheKey = React.useCallback((text: string) => text.trim(), []);

  const getResolvedTurnTranslation = React.useCallback(
    (turn: Pick<ScenarioTurn, "text" | "translation">) => {
      const cached = translationCache[getTranslationCacheKey(turn.text, selectedSupportNative)];

      if (cached) {
        return cached;
      }

      if ((session?.learnerProfile?.native || "English") === selectedSupportNative && turn.translation) {
        return turn.translation;
      }

      return null;
    },
    [getTranslationCacheKey, selectedSupportNative, session?.learnerProfile?.native, translationCache]
  );

  const ensureSupportTranslation = React.useCallback(
    async (turn: Pick<ScenarioTurn, "text" | "translation">) => {
      const existing = getResolvedTurnTranslation(turn);

      if (existing) {
        return existing;
      }

      const key = getTranslationCacheKey(turn.text, selectedSupportNative);
      const pendingRequest = translationRequestCacheRef.current[key];

      if (pendingRequest) {
        return await pendingRequest;
      }

      setTranslationStatus((current) => ({
        ...current,
        [key]: "generating"
      }));

      const request = translateScenarioTurn(user, sessionId, turn.text, selectedSupportNative)
        .then((response) => {
          setTranslationCache((current) => ({
            ...current,
            [key]: response.translation
          }));
          setTranslationStatus((current) => ({
            ...current,
            [key]: response.liveModelCall ? "ready" : "cached"
          }));
          return response.translation;
        })
        .finally(() => {
          delete translationRequestCacheRef.current[key];
        });

      translationRequestCacheRef.current[key] = request;
      return await request;
    },
    [getResolvedTurnTranslation, getTranslationCacheKey, selectedSupportNative, sessionId, user]
  );

  const ensureTutorSpeech = React.useCallback(
    async (text: string) => {
      const key = getSpeechCacheKey(text);
      const cached = speechCache[key];

      if (cached) {
        return cached;
      }

      const pendingRequest = speechRequestCacheRef.current[key];

      if (pendingRequest) {
        return await pendingRequest;
      }

      const request = synthesizeScenarioTutorSpeech(user, sessionId, text)
        .then((response) => {
          setSpeechCache((current) => ({
            ...current,
            [key]: response
          }));
          return response;
        })
        .finally(() => {
          delete speechRequestCacheRef.current[key];
        });

      speechRequestCacheRef.current[key] = request;
      return await request;
    },
    [getSpeechCacheKey, sessionId, speechCache, user]
  );

  const speakPhrase = React.useCallback((text: string) => {
    const clean = stripNiqqud(text).trim();

    if (!clean) {
      return;
    }

    Speech.stop();
    Speech.speak(clean, {
      language: "he-IL",
      pitch: 1.0,
      rate: 0.92
    });
  }, []);

  const playTutorAudio = React.useCallback(async (speech: ScenarioSpeechResponse) => {
    const player = tutorPlayerRef.current;
    const dataUri = `data:${speech.mimeType};base64,${speech.audioBase64}`;
    setIsFallbackTutorSpeaking(false);
    player.pause();
    player.replace({ uri: dataUri });
    player.play();
  }, []);

  const speakTutorTurn = React.useCallback(
    async (turn: Pick<ScenarioTurn, "text" | "translation">) => {
      const cleanReply = stripNiqqud(turn.text).trim();

      if (!cleanReply) {
        return;
      }

      const currentTranslation = await ensureSupportTranslation(turn).catch(() => getResolvedTurnTranslation(turn) || "");
      const cleanTranslation = currentTranslation.trim();

      try {
        const speech = await ensureTutorSpeech(cleanReply);
        await playTutorAudio(speech);
      } catch {
        Speech.stop();
        setIsFallbackTutorSpeaking(true);
        Speech.speak(cleanReply, {
          language: "he-IL",
          pitch: 1.0,
          rate: 0.92,
          onStopped: () => setIsFallbackTutorSpeaking(false),
          onError: () => setIsFallbackTutorSpeaking(false),
          onDone: cleanTranslation
            ? () => {
                setIsFallbackTutorSpeaking(false);
                Speech.speak(cleanTranslation, {
                  language: supportLanguage.speechLanguage,
                  pitch: 1.0,
                  rate: 0.95
                });
              }
            : () => setIsFallbackTutorSpeaking(false)
        });
      }
    },
    [ensureSupportTranslation, ensureTutorSpeech, getResolvedTurnTranslation, playTutorAudio, supportLanguage.speechLanguage]
  );

  React.useEffect(() => {
    let active = true;

    async function prepareAudio() {
      try {
        const permission = await requestRecordingPermissionsAsync();

        if (!permission.granted) {
          if (active) {
            setError("Microphone permission is required for spoken practice.");
          }
          return;
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true
        });

        if (active) {
          setRecordingReady(true);
        }
      } catch {
        if (active) {
          setError("Failed to prepare microphone recording.");
        }
      }
    }

    void prepareAudio();

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    void setIsAudioActiveAsync(true).catch(() => undefined);

    return () => {
      clearVoiceStopTimer();
      tutorPlayerRef.current.pause();
      tutorPlayerRef.current.remove();
    };
  }, [clearVoiceStopTimer]);

  React.useEffect(() => {
    let active = true;
    const sessionRef = doc(firestore, "users", user.uid, "scenarioSessions", sessionId);

    const unsubscribe = onSnapshot(
      sessionRef,
      (snapshot) => {
        if (!active) {
          return;
        }

        if (!snapshot.exists()) {
          if (!initialSnapshotSeenRef.current) {
            initialSnapshotSeenRef.current = true;
            setLoading(false);
          }
          return;
        }

        const data = snapshot.data() as ScenarioSessionResponse;
        const existingTurns = Array.isArray(data.turns) ? data.turns : [];
        const fallbackTurns =
          existingTurns.length > 0
            ? existingTurns
            : [
                {
                  role: "tutor" as const,
                  text: data.conversation?.starterLine || "Let's begin.",
                  createdAt: new Date().toISOString(),
                  provider: data.provider,
                  model: undefined,
                  liveModelCall: false
                }
              ];

        setSession(data);
        setSelectedSupportNative(data.learnerProfile?.native || "English");
        if (data.supportTranslations && data.learnerProfile?.native) {
          const persisted = data.supportTranslations[data.learnerProfile.native] || {};
          setTranslationCache((current) => {
            const next = { ...current };

            for (const entry of Object.values(persisted)) {
              if (typeof entry === "string") {
                continue;
              }

              const sourceText = entry?.sourceText?.trim();
              const translation = entry?.translation?.trim();

              if (sourceText && translation) {
                next[getTranslationCacheKey(sourceText, data.learnerProfile?.native || "English")] = translation;
              }
            }

            return next;
          });
          setTranslationStatus((current) => {
            const next = { ...current };

            for (const entry of Object.values(persisted)) {
              if (typeof entry === "string") {
                continue;
              }

              const sourceText = entry?.sourceText?.trim();
              const translation = entry?.translation?.trim();

              if (sourceText && translation) {
                next[getTranslationCacheKey(sourceText, data.learnerProfile?.native || "English")] = "cached";
              }
            }

            return next;
          });
        }
        setTurns(fallbackTurns as LocalScenarioTurn[]);
        setLoading(false);
        initialSnapshotSeenRef.current = true;
      },
      async () => {
        if (!active) {
          return;
        }

        try {
          const data = await getScenarioSession(user, sessionId);
          if (!active) {
            return;
          }

          setSession(data);
          setSelectedSupportNative(data.learnerProfile?.native || "English");
          const existingTurns = Array.isArray(data.turns) ? data.turns : [];
          if (data.supportTranslations && data.learnerProfile?.native) {
            const persisted = data.supportTranslations[data.learnerProfile.native] || {};
            setTranslationCache((current) => {
              const next = { ...current };

              for (const entry of Object.values(persisted)) {
                if (typeof entry === "string") {
                  continue;
                }

                const sourceText = entry?.sourceText?.trim();
                const translation = entry?.translation?.trim();

                if (sourceText && translation) {
                  next[getTranslationCacheKey(sourceText, data.learnerProfile?.native || "English")] = translation;
                }
              }

              return next;
            });
            setTranslationStatus((current) => {
              const next = { ...current };

              for (const entry of Object.values(persisted)) {
                if (typeof entry === "string") {
                  continue;
                }

                const sourceText = entry?.sourceText?.trim();
                const translation = entry?.translation?.trim();

                if (sourceText && translation) {
                  next[getTranslationCacheKey(sourceText, data.learnerProfile?.native || "English")] = "cached";
                }
              }

              return next;
            });
          }
          setTurns(
            existingTurns.length > 0
              ? (existingTurns as LocalScenarioTurn[])
              : [
                  {
                    role: "tutor",
                    text: data.conversation?.starterLine || "Let's begin.",
                    createdAt: new Date().toISOString(),
                    provider: data.provider,
                    model: undefined,
                    liveModelCall: false
                  }
                ]
          );
        } catch {
          if (active) {
            setError("Failed to load scenario session.");
            setTurns([]);
          }
        } finally {
          if (active) {
            setLoading(false);
            initialSnapshotSeenRef.current = true;
          }
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [getTranslationCacheKey, sessionId, user.uid]);

  React.useEffect(() => {
    if (sending) {
      setMode("thinking");
      return;
    }

    if (recorderState.isRecording) {
      setMode("listening");
      return;
    }

    const lastTurn = turns[turns.length - 1];
    if (lastTurn?.role === "tutor") {
      setMode("speaking");
    } else {
      setMode("listening");
    }
  }, [recorderState.isRecording, sending, turns]);

  React.useEffect(() => {
    let active = true;

    async function backfillSupportTranslations() {
      for (const turn of turns) {
        if (
          !active ||
          (turn.role !== "tutor" && !(turn.role === "learner" && turn.inputMode === "voice"))
        ) {
          continue;
        }

        if (getResolvedTurnTranslation(turn)) {
          continue;
        }

        try {
          await ensureSupportTranslation(turn);
        } catch {
          // Do not block the conversation if one backfill request fails.
        }
      }
    }

    void backfillSupportTranslations();

    return () => {
      active = false;
    };
  }, [ensureSupportTranslation, getResolvedTurnTranslation, selectedSupportNative, turns]);

  React.useEffect(() => {
    const lastTurn = turns[turns.length - 1];
    const starterLine = session?.conversation?.starterLine?.trim() || "";
    const onlyStarterLine =
      turns.length === 1 &&
      lastTurn?.role === "tutor" &&
      starterLine &&
      lastTurn.text.trim() === starterLine;

    if (!autoSpeakEnabled || !lastTurn || lastTurn.role !== "tutor" || onlyStarterLine) {
      return;
    }

    const turnKey = `${lastTurn.createdAt}:${lastTurn.text}`;

    if (lastSpokenTutorTurnRef.current === turnKey) {
      return;
    }

    lastSpokenTutorTurnRef.current = turnKey;
    speakTutorTurn(lastTurn);
  }, [autoSpeakEnabled, session?.conversation?.starterLine, speakTutorTurn, turns]);

  const activePronunciation = selectedCorrectionTurn?.pronunciation;
  const learnerVoiceTurns = React.useMemo(
    () =>
      turns.filter(
        (turn): turn is LocalScenarioTurn & { pronunciation: PronunciationFeedback } =>
          turn.role === "learner" && turn.inputMode === "voice" && !!turn.pronunciation
      ),
    [turns]
  );
  const latestVoiceFeedback = learnerVoiceTurns[learnerVoiceTurns.length - 1]?.pronunciation || null;
  const averageOverallScore =
    learnerVoiceTurns.length > 0
      ? Math.round(
          learnerVoiceTurns.reduce((sum, turn) => sum + turn.pronunciation.overallScore, 0) / learnerVoiceTurns.length
        )
      : null;
  const averageAccuracyScore =
    learnerVoiceTurns.length > 0
      ? Math.round(
          learnerVoiceTurns.reduce((sum, turn) => sum + turn.pronunciation.accuracyScore, 0) / learnerVoiceTurns.length
        )
      : null;
  const averageFluencyScore =
    learnerVoiceTurns.length > 0
      ? Math.round(
          learnerVoiceTurns.reduce((sum, turn) => sum + turn.pronunciation.fluencyScore, 0) / learnerVoiceTurns.length
        )
      : null;
  const flaggedIssueCount = learnerVoiceTurns.reduce((sum, turn) => sum + (turn.pronunciation.issues?.length || 0), 0);
  const sceneSummary = session?.variation?.situation || session?.theme?.blurb || "";
  const avatarSpeakingActive = tutorPlayerStatus.playing || isFallbackTutorSpeaking;
  const avatarListeningActive = recorderState.isRecording;

  React.useEffect(() => {
    return () => {
      setIsFallbackTutorSpeaking(false);
      Speech.stop();
    };
  }, []);

  async function handleSendMessage() {
    const message = textValue.trim();

    if (!message || sending || !session) {
      return;
    }

    setSending(true);
    setError("");

    const optimisticLearnerTurn: ScenarioTurn = {
      role: "learner",
      text: message,
      createdAt: new Date().toISOString(),
      inputMode: "text"
    };

    setTurns((current) => [...current, optimisticLearnerTurn]);
    setTextValue("");

    try {
      const response = await sendScenarioMessage(user, sessionId, message);
      setTurns((current) => [...current, response.tutorTurn]);
    } catch (messageError) {
      setError(messageError instanceof Error ? messageError.message : "Scenario message failed.");
    } finally {
      setSending(false);
    }
  }

  async function startVoiceRecording() {
    if (!recordingReady || sending || recorderState.isRecording) {
      return;
    }

    setError("");

    try {
      setVoiceDraft(null);
      clearVoiceStopTimer();
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      voiceRecordingActiveRef.current = true;
      voiceStopTimerRef.current = setTimeout(() => {
        if (voiceRecordingActiveRef.current) {
          void stopVoiceRecording();
        }
      }, VOICE_RECORDING_MAX_MS);
    } catch {
      setError("Failed to start recording.");
    }
  }

  async function stopVoiceRecording() {
    if (!recorderState.isRecording) {
      return;
    }

    try {
      voiceRecordingActiveRef.current = false;
      clearVoiceStopTimer();
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error("Recorded audio file was not available.");
      }

      const { mimeType, fileName } = inferAudioMeta(uri);
      const draft = { uri, mimeType, fileName };
      setVoiceDraft(draft);
      void handleSendVoice(draft);
    } catch (voiceError) {
      setError(voiceError instanceof Error ? voiceError.message : "Failed to stop recording.");
    }
  }

  async function handleSendVoice(draftOverride?: VoiceDraft) {
    if (sending || !session) {
      return;
    }

    try {
      clearVoiceStopTimer();
      voiceRecordingActiveRef.current = false;
      let draft = draftOverride || voiceDraft;

      if (recorderState.isRecording) {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;

        if (!uri) {
          throw new Error("Recorded audio file was not available.");
        }

        const meta = inferAudioMeta(uri);
        draft = { uri, ...meta };
        setVoiceDraft(draft);
      }

      if (!draft) {
        throw new Error("Record a voice draft first, then send it.");
      }

      const voiceLearnerId = `voice-learner-${Date.now()}`;
      const pendingTutorId = `pending-tutor-${Date.now()}`;
      const voicePreviewText = "Voice note sent";

      setTurns((current) => [
        ...current,
        {
          role: "learner",
          text: voicePreviewText,
          createdAt: new Date().toISOString(),
          inputMode: "voice",
          localId: voiceLearnerId
        },
        {
          role: "tutor",
          text: "",
          createdAt: new Date().toISOString(),
          localId: pendingTutorId,
          pending: true
        }
      ]);

      setSending(true);
      setError("");
      const requestStartedAt = Date.now();

      const response = await sendScenarioVoice(user, sessionId, {
        audioUri: draft.uri,
        mimeType: draft.mimeType,
        fileName: draft.fileName,
        referenceText: textValue.trim() || undefined
      });

      setTurns((current) =>
        current.map((turn) => {
          if (turn.localId === voiceLearnerId) {
            return response.learnerTurn;
          }
          if (turn.localId === pendingTutorId) {
            return response.tutorTurn;
          }
          return turn;
        })
      );
      setTextValue("");
      setVoiceDraft(null);
      setRequestMetrics({
        lastResponseMs: Date.now() - requestStartedAt,
        lastInputMode: "voice"
      });
      void ensureTutorSpeech(response.tutorTurn.text)
        .then((speech) => playTutorAudio(speech))
        .catch(() => void speakTutorTurn(response.tutorTurn));
    } catch (voiceError) {
      setTurns((current) => current.filter((turn) => !String(turn.localId || "").startsWith("voice-learner-") && !String(turn.localId || "").startsWith("pending-tutor-")));
      setError(voiceError instanceof Error ? voiceError.message : "Failed to send the recorded voice.");
    } finally {
      clearVoiceStopTimer();
      voiceRecordingActiveRef.current = false;
      setSending(false);
    }
  }

  async function handleSendMessageLive() {
    const message = textValue.trim();

    if (!message || sending || !session) {
      return;
    }

    if (!isHebrewOnlyLearnerText(message)) {
      setError("Send your learner turn in Hebrew only. Use the hint button if you need a phrase.");
      return;
    }

    setSending(true);
    setError("");

    const pendingTutorId = `pending-tutor-${Date.now()}`;
    const learnerLocalId = `text-learner-${Date.now()}`;

    setTurns((current) => [
      ...current,
      {
        role: "learner",
        text: message,
        createdAt: new Date().toISOString(),
        inputMode: "text",
        localId: learnerLocalId
      },
      {
        role: "tutor",
        text: "",
        createdAt: new Date().toISOString(),
        localId: pendingTutorId,
        pending: true
      }
    ]);
    setTextValue("");
    const requestStartedAt = Date.now();

    try {
      const response = await sendScenarioMessage(user, sessionId, message);
      setTurns((current) =>
        current.map((turn) => {
          if (turn.localId === learnerLocalId) {
            return {
              role: "learner",
              text: message,
              createdAt: turn.createdAt,
              inputMode: "text"
            };
          }
          if (turn.localId === pendingTutorId) {
            return response.tutorTurn;
          }
          return turn;
        })
      );
      setRequestMetrics({
        lastResponseMs: Date.now() - requestStartedAt,
        lastInputMode: "text"
      });
      void ensureTutorSpeech(response.tutorTurn.text)
        .then((speech) => playTutorAudio(speech))
        .catch(() => void speakTutorTurn(response.tutorTurn));
    } catch {
      setError("Voice scenario failed.");
    } finally {
      setSending(false);
    }
  }

  async function handleResetScene() {
    if (!session?.theme?.id || sending) {
      return;
    }

    setShowSceneMenu(false);
    setSending(true);
    setError("");

    try {
      const freshSession = await launchScenario(user, session.theme.id, "openai", true);
      onReplaceSession(freshSession.sessionId);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Failed to reset the scene.");
      setSending(false);
    }
  }

  async function handleChangeSupportLanguage(native: string) {
    if (sending || native === selectedSupportNative) {
      setShowSceneMenu(false);
      return;
    }

    setError("");
    setSelectedSupportNative(native);

    try {
      await updateSupportLanguage(user, { native });
      setSession((current) =>
        current
          ? {
              ...current,
              learnerProfile: {
                ...current.learnerProfile,
                native
              }
            }
          : current
      );
      setShowSceneMenu(false);
    } catch (updateError) {
      setSelectedSupportNative(session?.learnerProfile?.native || "English");
      setError(updateError instanceof Error ? updateError.message : "Failed to update support language.");
    }
  }

  const toggleTranslation = (index: number) => {
    const turn = turns[index];
    const nextVisible = !showTranslations[index];

    if (nextVisible && turn?.role === "tutor") {
      void ensureSupportTranslation(turn).catch(() => undefined);
    }

    setShowTranslations((prev) => ({
      ...prev,
      [index]: nextVisible
    }));
  };

  const hintItems = [
    { he: "אֲנִי רוֹצֶה גֹּדֶל בֵּינוֹנִי, בְּבַקָּשָׁה.", en: "I want medium size, please." },
    { he: "מַה הַהֶבְדֵּל בֵּין הַגְּדָלִים?", en: "What's the difference between the sizes?" }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={onExit} style={styles.topPill}>
          {/* Custom thin close vector */}
          <View style={styles.closeVector}>
            <View style={[styles.closeLine, { transform: [{ rotate: "45deg" }] }]} />
            <View style={[styles.closeLine, { transform: [{ rotate: "-45deg" }] }]} />
          </View>
        </Pressable>
        <View style={styles.titleWrap}>
          <View style={styles.titleInner}>
            <Text style={styles.title}>Dana</Text>
            <Text style={styles.titleHe}>דָּנָה</Text>
            {/* Custom thin chevron vector */}
            <View style={styles.chevronVector}>
              <View style={[styles.chevronLine, { left: 0, transform: [{ rotate: "45deg" }] }]} />
              <View style={[styles.chevronLine, { right: 0, transform: [{ rotate: "-45deg" }] }]} />
            </View>
          </View>
        </View>
        
        {/* Help Button - Feather-style help-circle */}
        <Pressable onPress={() => setShowHints(true)} style={styles.helpButtonContainer}>
          <View style={styles.helpIconCircleOuter}>
            <View style={styles.helpIconCircleInner}>
              <Text style={styles.helpIconText}>?</Text>
            </View>
          </View>
        </Pressable>

        <Pressable onPress={() => setShowSceneMenu(true)} style={styles.topPill}>
          <SettingsGlyph />
        </Pressable>
      </View>

      {/* Expanded Avatar */}
      {!minimized ? (
        <View style={styles.avatarWrap}>
          <AvatarWindow
            voiceName={session?.tutorVoice?.name || "Dana"}
            speakingActive={avatarSpeakingActive}
            listeningActive={avatarListeningActive}
            onMinimize={() => setMinimized(true)}
          />
        </View>
      ) : null}

      {/* Transcript Scroll Area */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.terracotta} />
        </View>
      ) : (
            <ScrollView contentContainerStyle={styles.transcriptWrap} showsVerticalScrollIndicator={false}>
          {minimized ? <MinimizedAvatar mode={mode} onExpand={() => setMinimized(false)} /> : null}
          {turns.map((turn, index) => (
            <MessageBubble
              key={`${turn.role}-${turn.createdAt}-${index}`}
              turn={{
                ...turn,
                translation: getResolvedTurnTranslation(turn) || turn.translation
              }}
              index={index}
              tutorName={session?.tutorVoice?.name || "Dana"}
              speaking={mode === "speaking" && index === turns.length - 1 && turn.role === "tutor"}
              showTranslation={!!showTranslations[index]}
              translationStatus={
                turn.role === "tutor"
                  ? translationStatus[getTranslationCacheKey(turn.text, selectedSupportNative)] || null
                  : null
              }
              onToggleTranslation={() => toggleTranslation(index)}
              onSeeMore={() => {
                setSelectedCorrectionTurn(turn);
                setShowCorrectionSheet(true);
              }}
              onReplay={() => (turn.role === "tutor" ? void speakTutorTurn(turn) : speakPhrase(turn.text))}
            />
          ))}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Hints Sheet Modal */}
      <Modal
        visible={showHints}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHints(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowHints(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetGrabber} />
            <Text style={styles.sheetEyebrow}>NEED A HINT?</Text>
            <Text style={styles.sheetTitle}>You can say…</Text>
            <View style={styles.sheetList}>
              {hintItems.map((item) => (
                <Pressable
                  key={item.he}
                  style={styles.sheetItem}
                  onPress={() => {
                    setTextValue(item.he);
                    setShowHints(false);
                  }}
                >
                  <View style={styles.sheetItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetItemText}>{item.he}</Text>
                      <Text style={styles.sheetItemSubText}>"{item.en}"</Text>
                    </View>
                    <View style={styles.sheetItemListen}><SpeakerGlyph tone="terracotta" compact /></View>
                  </View>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hintFooterText}>
              Tap a phrase to hear it. Use it as a starting point — your own words are better.
            </Text>
            <Pressable style={styles.sheetButton} onPress={() => setShowHints(false)}>
              <Text style={styles.sheetButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Pronunciation Correction Sheet Modal */}
      <Modal
        visible={showCorrectionSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCorrectionSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowCorrectionSheet(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetGrabber} />
            <Text style={styles.sheetEyebrow}>SPEAK BETTER</Text>
            <Text style={styles.sheetTitle}>How to say it more clearly</Text>

            {activePronunciation ? (
              <>
                <View style={styles.pronunciationScoreRow}>
                  <Text style={styles.pronunciationScorePill}>Overall {activePronunciation.overallScore}</Text>
                  <Text style={styles.pronunciationScorePill}>Accuracy {activePronunciation.accuracyScore}</Text>
                  <Text style={styles.pronunciationScorePill}>Fluency {activePronunciation.fluencyScore}</Text>
                </View>
                <Text style={styles.correctionDesc}>{activePronunciation.feedback || "Keep practicing this phrase more clearly."}</Text>
                {activePronunciation.issues?.length ? (
                  <View style={styles.issueDetailStack}>
                    {prioritizePronunciationIssues(activePronunciation.issues).map((issue, issueIndex) => (
                      <View key={`${issue.label}-${issueIndex}`} style={styles.issueDetailCard}>
                        <Text style={styles.issueDetailTitle}>{getFriendlyIssueTitle(issue.label)}</Text>
                        <Text style={styles.issueDetailBody}>Heard like: {issue.heardApproximation || "unclear"}</Text>
                        <Text style={styles.issueDetailBody}>Try this sound: {issue.expectedSound || "not provided"}</Text>
                        <Text style={styles.issueDetailBody}>Practice word: {issue.affectedWord || "not provided"}</Text>
                        <Text style={styles.issueDetailBody}>{issue.hint}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.correctionDesc}>No pronunciation issue details were returned for this turn.</Text>
            )}

            <View style={styles.correctionActions}>
              <Pressable style={styles.correctionBtnGhost} onPress={() => setShowCorrectionSheet(false)}>
                <Text style={styles.correctionBtnGhostText}>Later</Text>
              </Pressable>
              <Pressable style={styles.correctionBtnTerra} onPress={() => setShowCorrectionSheet(false)}>
                <View style={styles.correctionBtnTerraInner}><MicGlyph tone="bone" /><Text style={styles.correctionBtnTerraText}>Try again</Text></View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSessionReview}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSessionReview(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowSessionReview(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetGrabber} />
            <Text style={styles.sheetEyebrow}>SESSION REVIEW</Text>
            <Text style={styles.sheetTitle}>Conversation details</Text>
            {session ? (
              <View style={styles.reviewSection}>
                <View style={styles.sceneSummaryHeader}>
                  <Text style={styles.sceneSummaryEyebrow}>SCENARIO</Text>
                  <Text style={styles.sceneSummaryBand}>{session.theme.band}</Text>
                </View>
                <Text style={styles.sceneSummaryTitle}>{session.theme.title}</Text>
                <Text style={styles.sceneSummaryBody}>{sceneSummary}</Text>
              </View>
            ) : null}
            <View style={styles.reviewSection}>
              <Text style={styles.sceneSummaryEyebrow}>VOICE TEST</Text>
              <View style={styles.insightsGrid}>
                <InsightStat label="Overall" value={averageOverallScore === null ? "--" : String(averageOverallScore)} />
                <InsightStat label="Accuracy" value={averageAccuracyScore === null ? "--" : String(averageAccuracyScore)} />
                <InsightStat label="Fluency" value={averageFluencyScore === null ? "--" : String(averageFluencyScore)} />
                <InsightStat label="Speed" value={formatLatency(requestMetrics.lastResponseMs)} />
              </View>
              <Text style={styles.reviewCopy}>
                {latestVoiceFeedback
                  ? `${learnerVoiceTurns.length} voice test${learnerVoiceTurns.length === 1 ? "" : "s"} completed. ${flaggedIssueCount} pronunciation issue${flaggedIssueCount === 1 ? "" : "s"} flagged so far.`
                  : "Start with a voice turn to see pronunciation accuracy, fluency, and response speed."}
              </Text>
              {requestMetrics.lastInputMode ? (
                <Text style={styles.insightsSubtle}>Latest measured response came from a {requestMetrics.lastInputMode} turn.</Text>
              ) : null}
            </View>
            <Pressable style={styles.sheetButton} onPress={() => setShowSessionReview(false)}>
              <Text style={styles.sheetButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSceneMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSceneMenu(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowSceneMenu(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetGrabber} />
            <Text style={styles.sheetEyebrow}>SCENE</Text>
            <Text style={styles.sheetTitle}>Conversation controls</Text>
            <Pressable style={styles.sheetItem} onPress={() => setAutoSpeakEnabled((value) => !value)}>
              <Text style={styles.sheetItemActionTitle}>
                {autoSpeakEnabled ? "Tutor voice is on" : "Tutor voice is off"}
              </Text>
              <Text style={styles.sheetItemSubText}>
                {autoSpeakEnabled
                  ? "AI replies speak automatically. Tap to mute them."
                  : "AI replies are muted. Tap to turn speech back on."}
              </Text>
            </Pressable>
            <View style={styles.sheetItemStatic}>
              <Text style={styles.sheetItemActionTitle}>Support language voice</Text>
              <Text style={styles.sheetItemSubText}>
                Hebrew plays first. Then the support translation plays in {supportLanguage.label}.
              </Text>
              <View style={styles.languageOptionStack}>
                {NORMALIZED_SUPPORT_LANGUAGE_OPTIONS.map((option) => {
                  const selected = option.native === selectedSupportNative;
                  return (
                    <Pressable
                      key={option.native}
                      style={[styles.languageOptionPill, selected ? styles.languageOptionPillActive : null]}
                      onPress={() => void handleChangeSupportLanguage(option.native)}
                    >
                      <Text style={[styles.languageOptionPillText, selected ? styles.languageOptionPillTextActive : null]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Pressable style={styles.sheetItem} onPress={() => {
              setShowSceneMenu(false);
              setShowSessionReview(true);
            }}>
              <Text style={styles.sheetItemActionTitle}>Session review</Text>
              <Text style={styles.sheetItemSubText}>Open the hidden scenario and voice test details.</Text>
            </Pressable>
            <Pressable style={styles.sheetItem} onPress={handleResetScene} disabled={sending}>
              <Text style={styles.sheetItemActionTitle}>Start fresh scene</Text>
              <Text style={styles.sheetItemSubText}>Create a brand new variation and reset the conversation.</Text>
            </Pressable>
            <Pressable style={styles.sheetItem} onPress={onExit}>
              <Text style={styles.sheetItemActionTitle}>Back to home</Text>
              <Text style={styles.sheetItemSubText}>Leave this conversation and return to the scenario list.</Text>
            </Pressable>
            <Pressable style={styles.sheetButton} onPress={() => setShowSceneMenu(false)}>
              <Text style={styles.sheetButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Bottom Composer Area */}
      <View style={styles.bottomArea}>
        {textValue.trim() ? (
          <Pressable style={styles.playHintButton} onPress={() => speakPhrase(textValue)}>
            <Text style={styles.playHintButtonText}>Play hint aloud</Text>
          </Pressable>
        ) : null}
        {inputMode === "text" ? (
          <View style={styles.textComposerWrap}>
            <Pressable style={styles.micSwitchButton} onPress={() => setInputMode("voice")}>
              <MicGlyph tone="inkMute" />
            </Pressable>
            
            <View style={styles.textComposer}>
              <TextInput
                value={textValue}
                onChangeText={setTextValue}
                placeholder="Reply in Hebrew…"
                placeholderTextColor={colors.inkFaint}
                style={styles.input}
              />
              <Pressable onPress={() => setShowHints(true)} style={styles.inlineHintButton}>
                <Text style={styles.inlineHintButtonText}>?</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.sendButton, !textValue.trim() || sending ? styles.sendButtonDisabled : null]}
              onPress={handleSendMessageLive}
              disabled={!textValue.trim() || sending}
            >
              <Text style={styles.sendButtonText}>➤</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.voiceComposer}>
            <View style={styles.voiceRow}>
              <Pressable onPress={() => setInputMode("text")} style={styles.typeTextToggle}>
                <Text style={styles.typeTextToggleText}>Type ›</Text>
              </Pressable>

              <View style={styles.orbButtonContainer}>
                {recorderState.isRecording ? (
                  <View style={styles.lockIndicator}>
                    <LockGlyph />
                  </View>
                ) : null}
              <Pressable
                style={[
                  styles.voiceButton,
                  recorderState.isRecording ? styles.voiceButtonRecording : null,
                  !recordingReady || sending ? styles.sendButtonDisabled : null
                  ]}
                  onPressIn={() => void startVoiceRecording()}
                  onPressOut={() => void stopVoiceRecording()}
                  disabled={!recordingReady || sending}
                >
                  {/* Custom high-fidelity microphone vector */}
                  <View style={styles.micIconVector}>
                    <View style={styles.micPill} />
                    <View style={styles.micCup} />
                    <View style={styles.micStandLeg} />
                  <View style={styles.micStandBase} />
                  </View>
                </Pressable>
              </View>

              {/* Feather help-circle hint button */}
              <Pressable onPress={() => setShowHints(true)} style={styles.voiceHintButton}>
                <View style={styles.helpIconCircleOuter}>
                  <View style={styles.helpIconCircleInner}>
                    <Text style={styles.helpIconText}>?</Text>
                  </View>
                </View>
                <Text style={styles.voiceHintLabel}>Hint</Text>
              </Pressable>
            </View>
            <Text style={styles.voiceDraftText}>
              Press and hold to talk. Release to send. Tutor replies speak in Hebrew only.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function AvatarWindow({
  voiceName,
  speakingActive,
  listeningActive,
  onMinimize
}: {
  voiceName: string;
  speakingActive: boolean;
  listeningActive: boolean;
  onMinimize: () => void;
}) {
  const breathingAnim = React.useRef(new Animated.Value(0)).current;
  const mouthAnim = React.useRef(new Animated.Value(0.12)).current;
  const auraAnim = React.useRef(new Animated.Value(0.12)).current;
  const eyeOpenAnim = React.useRef(new Animated.Value(1)).current;
  const browAnim = React.useRef(new Animated.Value(0)).current;
  const leanAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(eyeOpenAnim, {
          toValue: 0.2,
          duration: 90,
          useNativeDriver: false
        }),
        Animated.timing(eyeOpenAnim, {
          toValue: 1,
          duration: 120,
          useNativeDriver: false
        })
      ])
    );

    blinkLoop.start();

    return () => {
      blinkLoop.stop();
    };
  }, [eyeOpenAnim]);

  React.useEffect(() => {
    let loop: Animated.CompositeAnimation;

    if (speakingActive) {
      loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(breathingAnim, {
              toValue: -6,
              duration: 280,
              useNativeDriver: false
            }),
            Animated.timing(breathingAnim, {
              toValue: 1,
              duration: 220,
              useNativeDriver: false
            })
          ]),
          Animated.sequence([
            Animated.timing(mouthAnim, {
              toValue: 1,
              duration: 130,
              useNativeDriver: false
            }),
            Animated.timing(mouthAnim, {
              toValue: 0.22,
              duration: 110,
              useNativeDriver: false
            }),
            Animated.timing(mouthAnim, {
              toValue: 0.82,
              duration: 140,
              useNativeDriver: false
            }),
            Animated.timing(mouthAnim, {
              toValue: 0.12,
              duration: 120,
              useNativeDriver: false
            })
          ]),
          Animated.sequence([
            Animated.timing(auraAnim, {
              toValue: 0.42,
              duration: 300,
              useNativeDriver: false
            }),
            Animated.timing(auraAnim, {
              toValue: 0.18,
              duration: 300,
              useNativeDriver: false
            })
          ])
        ])
      );
      Animated.timing(browAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false
      }).start();
      Animated.timing(leanAnim, {
        toValue: 0.08,
        duration: 220,
        useNativeDriver: false
      }).start();
    } else if (listeningActive) {
      loop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(breathingAnim, {
              toValue: -2,
              duration: 900,
              useNativeDriver: false
            }),
            Animated.timing(breathingAnim, {
              toValue: 0,
              duration: 900,
              useNativeDriver: false
            })
          ]),
          Animated.sequence([
            Animated.timing(auraAnim, {
              toValue: 0.28,
              duration: 650,
              useNativeDriver: false
            }),
            Animated.timing(auraAnim, {
              toValue: 0.14,
              duration: 650,
              useNativeDriver: false
            })
          ])
        ])
      );
      Animated.timing(mouthAnim, {
        toValue: 0.08,
        duration: 180,
        useNativeDriver: false
      }).start();
      Animated.timing(browAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: false
      }).start();
      Animated.sequence([
        Animated.timing(leanAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: false
        }),
        Animated.timing(leanAnim, {
          toValue: 0.9,
          duration: 120,
          useNativeDriver: false
        })
      ]).start();
    } else {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breathingAnim, {
            toValue: -2,
            duration: 1200,
            useNativeDriver: false
          }),
          Animated.timing(breathingAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: false
          })
        ])
      );
      Animated.timing(mouthAnim, {
        toValue: 0.1,
        duration: 220,
        useNativeDriver: false
      }).start();
      Animated.timing(auraAnim, {
        toValue: 0.12,
        duration: 220,
        useNativeDriver: false
      }).start();
      Animated.timing(browAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false
      }).start();
      Animated.timing(leanAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false
      }).start();
    }

    loop.start();

    return () => {
      loop.stop();
    };
  }, [auraAnim, breathingAnim, browAnim, leanAnim, listeningActive, mouthAnim, speakingActive]);

  const mouthHeight = mouthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 20]
  });
  const mouthWidth = mouthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [26, 38]
  });
  const eyeHeight = eyeOpenAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 12]
  });
  const browLift = browAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4]
  });
  const headScale = leanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.07]
  });
  const headForwardY = leanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8]
  });
  const shoulderScale = leanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05]
  });

  return (
    <View style={styles.avatarCard}>
      <View style={styles.avatarBackdrop} />
      <Animated.View style={[styles.avatarAura, { opacity: auraAnim }]} />

      <View style={styles.windowGridLeft}>
        <View style={styles.gridLineHorizontal} />
        <View style={styles.gridLineHorizontal2} />
        <View style={styles.gridLineVertical} />
        <View style={styles.gridLineVertical2} />
      </View>
      <View style={styles.windowGridRight}>
        <View style={styles.gridLineHorizontal} />
        <View style={styles.gridLineHorizontal2} />
        <View style={styles.gridLineVertical} />
        <View style={styles.gridLineVertical2} />
      </View>

      <View style={styles.silhouetteContainer}>
        <Animated.View style={[styles.shoulders, { transform: [{ scale: shoulderScale }, { translateY: headForwardY }] }]} />
        <View style={styles.neck} />
        <Animated.View
          style={[
            styles.head,
            {
              transform: [{ translateY: Animated.add(breathingAnim, headForwardY) }, { scale: headScale }]
            }
          ]}
        >
          <View style={styles.hairCap} />
          <View style={styles.facePlane}>
            <View style={styles.browRow}>
              <Animated.View style={[styles.brow, { transform: [{ translateY: browLift }, { rotate: "-6deg" }] }]} />
              <Animated.View style={[styles.brow, { transform: [{ translateY: browLift }, { rotate: "6deg" }] }]} />
            </View>
            <View style={styles.eyeRow}>
              <Animated.View style={[styles.eye, { height: eyeHeight }]}>
                <View style={styles.pupil} />
              </Animated.View>
              <Animated.View style={[styles.eye, { height: eyeHeight }]}>
                <View style={styles.pupil} />
              </Animated.View>
            </View>
            <View style={styles.nose} />
            <Animated.View style={[styles.mouth, { height: mouthHeight, width: mouthWidth }]} />
          </View>
        </Animated.View>
      </View>

      <Pressable onPress={onMinimize} style={styles.avatarTopLeft}>
        <View style={styles.expandMinimizeIcon}>
          <View style={[styles.cornerLineH, { left: 0, top: 0 }]} />
          <View style={[styles.cornerLineV, { left: 0, top: 0 }]} />
          <View style={[styles.cornerLineH, { right: 0, top: 0 }]} />
          <View style={[styles.cornerLineV, { right: 0, top: 0 }]} />
          <View style={[styles.cornerLineH, { left: 0, bottom: 0 }]} />
          <View style={[styles.cornerLineV, { left: 0, bottom: 0 }]} />
          <View style={[styles.cornerLineH, { right: 0, bottom: 0 }]} />
          <View style={[styles.cornerLineV, { right: 0, bottom: 0 }]} />
        </View>
      </Pressable>

      <View style={styles.avatarTopRight}>
        <View
          style={[
            styles.avatarStatusDot,
            speakingActive
              ? styles.avatarStatusSpeaking
              : listeningActive
                ? styles.avatarStatusListening
                : null
          ]}
        />
        <Text style={styles.avatarStatusText}>{voiceName.toUpperCase()}</Text>
      </View>

      <View style={styles.avatarBottomRight}>
        <Pressable style={styles.avatarSmallControl}>
          <View style={styles.speakerVector}>
            <View style={styles.speakerBox} />
            <View style={styles.speakerCone} />
            <View style={styles.speakerWave1} />
            <View style={styles.speakerWave2} />
          </View>
        </Pressable>
        <Pressable style={styles.avatarSmallControl}>
          <View style={styles.cameraVector}>
            <View style={styles.cameraBox} />
            <View style={styles.cameraCone} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function MinimizedAvatar({ mode, onExpand }: { mode: Mode; onExpand: () => void }) {
  return (
    <Pressable style={styles.minimizedAvatar} onPress={onExpand}>
      <View style={styles.minimizedBackdrop} />
      <View style={styles.minimizedShoulders} />
      <View style={styles.minimizedHead} />
      <View
        style={[
          styles.minimizedDot,
          mode === "speaking"
            ? styles.avatarStatusSpeaking
            : mode === "listening"
            ? styles.avatarStatusListening
            : null
        ]}
      />
    </Pressable>
  );
}

function MessageBubble({
  turn,
  index,
  tutorName,
  speaking,
  showTranslation,
  translationStatus,
  onToggleTranslation,
  onSeeMore,
  onReplay
}: {
  turn: LocalScenarioTurn;
  index: number;
  tutorName: string;
  speaking: boolean;
  showTranslation: boolean;
  translationStatus: TranslationStatus | null;
  onToggleTranslation: () => void;
  onSeeMore: () => void;
  onReplay: () => void;
  }) {
  const isLearner = turn.role === "learner";
  const text = turn.text;
  const translation = turn.translation;
  const hasIssue = turn.pronunciation && turn.role === "learner";
  const issue = turn.pronunciation?.issues?.[0] || getPronunciationIssue(turn.pronunciation?.feedback);

  return (
    <View style={[styles.messageRow, isLearner ? styles.messageRowLearner : styles.messageRowTutor]}>
      <View
        style={[
          styles.messageCard,
          isLearner ? styles.messageCardLearner : styles.messageCardTutor,
          speaking ? styles.messageCardSpeaking : null
        ]}
      >
        {!isLearner ? (
          <View style={styles.tutorHeader}>
            <Text style={styles.messageLabel}>{tutorName.toUpperCase()}</Text>
          </View>
        ) : null}

        {turn.pending ? (
          <View style={styles.pendingTutorRow}>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text style={styles.pendingTutorText}>{tutorName} is responding in Hebrew…</Text>
          </View>
        ) : isLearner && turn.inputMode === "voice" ? (
          <Text style={[styles.messageText, styles.messageTextLearner]}>
            {text || "…"}
          </Text>
        ) : (
          <Text style={[styles.messageText, isLearner ? styles.messageTextLearner : styles.messageTextTutor]}>
            {text}
          </Text>
        )}

        {/* Translation Section (for Tutor only) */}
        {!isLearner && !turn.pending && translation && showTranslation ? (
          <>
            <Text style={styles.messageTranslation}>"{translation}"</Text>
            {translationStatus ? (
              <Text style={styles.messageTranslationStatus}>
                {translationStatus === "cached" ? "Cached" : translationStatus === "ready" ? "Ready" : "Generating..."}
              </Text>
            ) : null}
          </>
        ) : !isLearner && !turn.pending && showTranslation && translationStatus === "generating" ? (
          <Text style={styles.messageTranslationStatus}>Generating support translation...</Text>
        ) : null}

        {/* Action Controls (Audio Replay & Translate) under Tutor Bubbles */}
        {!isLearner && !turn.pending ? (
          <View style={styles.messageActionsRow}>
            {/* Custom volume/replay pill icon */}
            <Pressable style={styles.messageActionPill} onPress={onReplay}>
              <View style={styles.speakerVectorMini}>
                <View style={styles.speakerBoxMini} />
                <View style={styles.speakerConeMini} />
                <View style={styles.speakerWave1Mini} />
              </View>
            </Pressable>
            {/* Custom language translation toggle pill icon */}
            <Pressable
              style={[
                styles.messageActionPill,
                showTranslation ? styles.messageActionPillActive : null
              ]}
              onPress={onToggleTranslation}
            >
              <Text
                style={[
                  styles.messageActionPillText,
                  showTranslation ? styles.messageActionPillActiveText : null
                ]}
              >
                文A
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Inline Pronunciation Issue Banner for User Bubbles */}
        {isLearner && hasIssue ? (
          <Pressable
            onPress={onSeeMore}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [
              styles.pronunciationInlineButton,
              pressed ? { opacity: 0.8 } : null
            ]}
          >
            <Text style={styles.pronunciationInlineButtonText}>{getFriendlyIssueTitle(issue.label)}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function InsightStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.insightStatCard}>
      <Text style={styles.insightStatValue}>{value}</Text>
      <Text style={styles.insightStatLabel}>{label}</Text>
    </View>
  );
}

function getFriendlyIssueTitle(label: string): string {
  const normalized = label.trim().toUpperCase();

  if (normalized === "TZADI") {
    return "Tz sound";
  }

  if (normalized === "RESH") {
    return "R sound";
  }

  if (normalized === "AYIN") {
    return "Ayin sound";
  }

  if (normalized === "HET" || normalized === "CHET") {
    return "Kh sound";
  }

  return `${label.trim()} sound`;
}

function SpeakerGlyph({
  tone,
  compact = false
}: {
  tone: "bone" | "inkMute" | "terracotta";
  compact?: boolean;
}) {
  const color = tone === "bone" ? colors.bone : tone === "terracotta" ? colors.terracotta : colors.inkMute;

  return (
    <View style={[styles.speakerGlyph, compact ? styles.speakerGlyphCompact : null]}>
      <View style={[styles.speakerGlyphBox, { backgroundColor: color }]} />
      <View style={[styles.speakerGlyphCone, { borderRightColor: color }]} />
      <View style={[styles.speakerGlyphWaveShort, { backgroundColor: color }]} />
      <View style={[styles.speakerGlyphWaveTall, { backgroundColor: color }]} />
    </View>
  );
}

function MicGlyph({ tone }: { tone: "bone" | "inkMute" }) {
  const color = tone === "bone" ? colors.bone : colors.inkMute;

  return (
    <View style={styles.micGlyph}>
      <View style={[styles.micGlyphCapsule, { backgroundColor: color }]} />
      <View style={[styles.micGlyphCup, { borderColor: color }]} />
      <View style={[styles.micGlyphStem, { backgroundColor: color }]} />
      <View style={[styles.micGlyphBase, { backgroundColor: color }]} />
    </View>
  );
}

function LockGlyph() {
  return (
    <View style={styles.lockGlyph}>
      <View style={styles.lockGlyphShackle} />
      <View style={styles.lockGlyphBody} />
    </View>
  );
}

function SettingsGlyph() {
  return (
    <View style={styles.settingsGlyph}>
      <View style={styles.settingsGlyphRow}>
        <View style={styles.settingsGlyphLineWide} />
        <View style={styles.settingsGlyphDot} />
      </View>
      <View style={styles.settingsGlyphRow}>
        <View style={styles.settingsGlyphDot} />
        <View style={styles.settingsGlyphLineNarrow} />
      </View>
    </View>
  );
}

function inferAudioMeta(uri: string): { mimeType: string; fileName: string } {
  const lower = uri.toLowerCase();

  if (lower.endsWith(".webm")) {
    return { mimeType: "audio/webm", fileName: "learner.webm" };
  }

  if (lower.endsWith(".wav")) {
    return { mimeType: "audio/wav", fileName: "learner.wav" };
  }

  if (lower.endsWith(".3gp")) {
    return { mimeType: "audio/3gpp", fileName: "learner.3gp" };
  }

  return { mimeType: "audio/mp4", fileName: "learner.m4a" };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1] || "";

      if (!base64) {
        reject(new Error("Failed to convert the recording into base64."));
        return;
      }

      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read the recorded audio."));
    reader.readAsDataURL(blob);
  });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bone
  },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  topPill: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: "rgba(26,20,16,0.06)",
    alignItems: "center",
    justifyContent: "center"
  },
  settingsPillText: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "300"
  },
  titleWrap: {
    flex: 1,
    alignItems: "center"
  },
  titleInner: {
    flexDirection: "row",
    alignItems: "center"
  },
  title: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600"
  },
  titleHe: {
    color: colors.inkMute,
    fontSize: 15,
    fontWeight: "500",
    marginLeft: 6
  },
  chevronVector: {
    width: 8,
    height: 5,
    position: "relative",
    marginLeft: 4,
    top: 1
  },
  chevronLine: {
    position: "absolute",
    top: 1,
    width: 5,
    height: 1.5,
    backgroundColor: colors.inkMute
  },
  closeVector: {
    width: 12,
    height: 12,
    position: "relative"
  },
  closeLine: {
    position: "absolute",
    top: 5,
    left: 0,
    right: 0,
    height: 1.8,
    backgroundColor: colors.ink,
    borderRadius: 1
  },
  helpButtonContainer: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: "rgba(184,70,44,0.08)",
    borderWidth: 1,
    borderColor: "rgba(184,70,44,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  helpIconCircleOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  helpIconCircleInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center"
  },
  helpIconText: {
    color: colors.terracotta,
    fontSize: 11,
    fontWeight: "bold",
    top: -0.5
  },
  settingsGlyph: {
    width: 16,
    height: 14,
    justifyContent: "space-between"
  },
  settingsGlyphRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  settingsGlyphLineWide: {
    width: 10,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.ink
  },
  settingsGlyphLineNarrow: {
    width: 8,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.ink
  },
  settingsGlyphDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ink
  },
  avatarWrap: {
    paddingHorizontal: 16,
    paddingBottom: 14
  },
  avatarCard: {
    aspectRatio: 4.0 / 3.0,
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#D9A35E",
    position: "relative"
  },
  avatarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#D9A35E"
  },
  avatarAura: {
    position: "absolute",
    left: "50%",
    top: "18%",
    marginLeft: -96,
    width: 192,
    height: 192,
    borderRadius: 999,
    backgroundColor: "rgba(244,236,222,0.55)"
  },
  windowGridLeft: {
    position: "absolute",
    left: "8%",
    top: "12%",
    width: "28%",
    height: "68%",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(244,236,222,0.4)"
  },
  windowGridRight: {
    position: "absolute",
    right: "8%",
    top: "12%",
    width: "28%",
    height: "68%",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(244,236,222,0.4)",
    opacity: 0.5
  },
  gridLineHorizontal: {
    position: "absolute",
    top: "33%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(244,236,222,0.3)"
  },
  gridLineHorizontal2: {
    position: "absolute",
    top: "66%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(244,236,222,0.3)"
  },
  gridLineVertical: {
    position: "absolute",
    left: "33%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(244,236,222,0.3)"
  },
  gridLineVertical2: {
    position: "absolute",
    left: "66%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(244,236,222,0.3)"
  },
  silhouetteContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  shoulders: {
    position: "absolute",
    bottom: 0,
    width: 240,
    height: 110,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    backgroundColor: "#3A1810"
  },
  neck: {
    position: "absolute",
    bottom: 100,
    width: 36,
    height: 34,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: "#8E5C3D"
  },
  head: {
    position: "absolute",
    bottom: 112,
    width: 132,
    height: 156,
    borderRadius: 72,
    backgroundColor: "#D9A175"
  },
  hairCap: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    height: 84,
    borderRadius: 60,
    backgroundColor: "#2A1A0F"
  },
  facePlane: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 42,
    bottom: 18,
    alignItems: "center",
    justifyContent: "flex-start"
  },
  browRow: {
    marginTop: 18,
    width: 62,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  brow: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#2A1A0F"
  },
  eyeRow: {
    marginTop: 10,
    width: 54,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  eye: {
    width: 16,
    borderRadius: 8,
    backgroundColor: colors.bone,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  pupil: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2A1A0F"
  },
  nose: {
    marginTop: 10,
    width: 6,
    height: 16,
    borderRadius: 3,
    backgroundColor: "rgba(111,65,40,0.55)"
  },
  mouth: {
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: "#7A2B1E",
    borderWidth: 2,
    borderColor: "rgba(244,236,222,0.15)"
  },
  avatarTopLeft: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: "rgba(26,20,16,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  expandMinimizeIcon: {
    width: 14,
    height: 14,
    position: "relative"
  },
  cornerLineH: {
    position: "absolute",
    width: 5,
    height: 1.5,
    backgroundColor: colors.bone
  },
  cornerLineV: {
    position: "absolute",
    width: 1.5,
    height: 5,
    backgroundColor: colors.bone
  },
  avatarTopRight: {
    position: "absolute",
    top: 12,
    right: 12,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(26,20,16,0.4)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  avatarStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.6)"
  },
  avatarStatusSpeaking: {
    backgroundColor: colors.gold
  },
  avatarStatusListening: {
    backgroundColor: "#7DD3A3"
  },
  avatarStatusText: {
    color: colors.bone,
    fontSize: 9,
    letterSpacing: 1
  },
  avatarBottomRight: {
    position: "absolute",
    right: 10,
    bottom: 68,
    flexDirection: "row",
    gap: 8
  },
  avatarSmallControl: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: "rgba(26,20,16,0.35)",
    alignItems: "center",
    justifyContent: "center"
  },
  speakerGlyph: {
    flexDirection: "row",
    alignItems: "center"
  },
  speakerGlyphCompact: {
    transform: [{ scale: 0.9 }]
  },
  speakerGlyphBox: {
    width: 4,
    height: 6,
    borderRadius: 1
  },
  speakerGlyphCone: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderTopColor: "transparent",
    borderBottomWidth: 5,
    borderBottomColor: "transparent",
    borderRightWidth: 6,
    marginLeft: -1
  },
  speakerGlyphWaveShort: {
    width: 1.5,
    height: 4,
    borderRadius: 1,
    marginLeft: 2
  },
  speakerGlyphWaveTall: {
    width: 1.5,
    height: 8,
    borderRadius: 1,
    marginLeft: 1.5,
    opacity: 0.75
  },
  micGlyph: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  micGlyphCapsule: {
    position: "absolute",
    top: 1,
    width: 7,
    height: 10,
    borderRadius: 4
  },
  micGlyphCup: {
    position: "absolute",
    top: 5,
    width: 12,
    height: 8,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    borderWidth: 1.8,
    borderTopWidth: 0
  },
  micGlyphStem: {
    position: "absolute",
    bottom: 2.5,
    width: 1.8,
    height: 4
  },
  micGlyphBase: {
    position: "absolute",
    bottom: 1.5,
    width: 8,
    height: 1.8,
    borderRadius: 1
  },
  lockGlyph: {
    width: 14,
    height: 16,
    alignItems: "center",
    justifyContent: "flex-end"
  },
  lockGlyphShackle: {
    position: "absolute",
    top: 0,
    width: 8,
    height: 7,
    borderWidth: 1.8,
    borderBottomWidth: 0,
    borderColor: colors.bone,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6
  },
  lockGlyphBody: {
    width: 12,
    height: 9,
    borderRadius: 3,
    backgroundColor: colors.bone
  },
  speakerVector: {
    flexDirection: "row",
    alignItems: "center"
  },
  speakerBox: {
    width: 4,
    height: 6,
    backgroundColor: colors.bone
  },
  speakerCone: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderTopColor: "transparent",
    borderBottomWidth: 5,
    borderBottomColor: "transparent",
    borderRightWidth: 6,
    borderRightColor: colors.bone,
    marginLeft: -1
  },
  speakerWave1: {
    width: 1.5,
    height: 4,
    borderRadius: 1,
    backgroundColor: colors.bone,
    marginLeft: 2
  },
  speakerWave2: {
    width: 1.5,
    height: 8,
    borderRadius: 1,
    backgroundColor: colors.bone,
    marginLeft: 1.5,
    opacity: 0.7
  },
  cameraVector: {
    flexDirection: "row",
    alignItems: "center"
  },
  cameraBox: {
    width: 12,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.bone
  },
  cameraCone: {
    width: 0,
    height: 0,
    borderTopWidth: 3.5,
    borderTopColor: "transparent",
    borderBottomWidth: 3.5,
    borderBottomColor: "transparent",
    borderLeftWidth: 4,
    borderLeftColor: colors.bone,
    marginLeft: 1
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  transcriptWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 12
  },
  sceneSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  sceneSummaryEyebrow: {
    color: colors.terracotta,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: "700"
  },
  sceneSummaryBand: {
    color: colors.inkMute,
    fontSize: 12,
    fontWeight: "600"
  },
  sceneSummaryTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "600"
  },
  sceneSummaryBody: {
    color: colors.inkMute,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8
  },
  insightsCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: "rgba(26,20,16,0.08)"
  },
  insightsHeader: {
    gap: 6
  },
  insightsHeaderCopy: {
    color: "rgba(244,236,222,0.72)",
    fontSize: 12,
    lineHeight: 18
  },
  insightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14
  },
  insightStatCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(244,236,222,0.08)"
  },
  insightStatValue: {
    color: colors.bone,
    fontSize: 22,
    fontWeight: "700"
  },
  insightStatLabel: {
    color: "rgba(244,236,222,0.6)",
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: "uppercase"
  },
  insightsFootnote: {
    color: colors.bone,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14
  },
  insightsSubtle: {
    color: "rgba(244,236,222,0.6)",
    fontSize: 11,
    marginTop: 6
  },
  reviewSection: {
    marginBottom: 18
  },
  reviewCopy: {
    color: colors.inkMute,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14
  },
  minimizedAvatar: {
    position: "absolute",
    top: 0,
    right: 16,
    width: 72,
    height: 92,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#D9A35E",
    zIndex: 10
  },
  minimizedBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#D9A35E"
  },
  minimizedShoulders: {
    position: "absolute",
    bottom: 0,
    left: "50%",
    marginLeft: -38,
    width: 76,
    height: 38,
    borderTopLeftRadius: 38,
    borderTopRightRadius: 38,
    backgroundColor: "#3A1810"
  },
  minimizedHead: {
    position: "absolute",
    bottom: 26,
    left: "50%",
    marginLeft: -22,
    width: 44,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#D9A175"
  },
  minimizedDot: {
    position: "absolute",
    left: 6,
    bottom: 6,
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 2,
    borderColor: colors.bone
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 4
  },
  messageRowTutor: {
    justifyContent: "flex-start"
  },
  messageRowLearner: {
    justifyContent: "flex-end"
  },
  messageCard: {
    maxWidth: "84%",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  messageCardTutor: {
    backgroundColor: colors.ink
  },
  messageCardLearner: {
    backgroundColor: colors.terracotta
  },
  messageCardSpeaking: {
    borderWidth: 1,
    borderColor: "rgba(184,70,44,0.35)"
  },
  tutorHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4
  },
  messageLabel: {
    color: colors.gold,
    fontSize: 8.5,
    letterSpacing: 1.2
  },
  messageText: {
    fontSize: 22,
    lineHeight: 30,
    writingDirection: "rtl"
  },
  messageTextTutor: {
    color: colors.bone
  },
  messageTextLearner: {
    color: colors.bone
  },
  pendingTutorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 24
  },
  pendingTutorText: {
    color: "rgba(244,236,222,0.75)",
    fontSize: 13,
    fontStyle: "italic"
  },
  messageTranslation: {
    fontSize: 13,
    fontStyle: "italic",
    color: "rgba(244,236,222,0.65)",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(244,236,222,0.15)",
    borderStyle: "dashed"
  },
  messageTranslationStatus: {
    marginTop: 4,
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "rgba(244,236,222,0.48)"
  },
  messageActionsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    opacity: 0.75
  },
  messageActionPill: {
    width: 26,
    height: 26,
    borderRadius: radii.pill,
    backgroundColor: "rgba(244,236,222,0.08)",
    alignItems: "center",
    justifyContent: "center"
  },
  messageActionPillActive: {
    backgroundColor: colors.gold
  },
  messageActionPillText: {
    color: colors.bone,
    fontSize: 11
  },
  messageActionPillActiveText: {
    color: colors.ink
  },
  speakerVectorMini: {
    flexDirection: "row",
    alignItems: "center"
  },
  speakerBoxMini: {
    width: 3,
    height: 4,
    backgroundColor: colors.bone
  },
  speakerConeMini: {
    width: 0,
    height: 0,
    borderTopWidth: 3.5,
    borderTopColor: "transparent",
    borderBottomWidth: 3.5,
    borderBottomColor: "transparent",
    borderRightWidth: 4,
    borderRightColor: colors.bone,
    marginLeft: -1
  },
  speakerWave1Mini: {
    width: 1.2,
    height: 3,
    borderRadius: 0.5,
    backgroundColor: colors.bone,
    marginLeft: 1.5
  },
  pronunciationInlineButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: "rgba(26,20,16,0.18)",
    borderWidth: 1,
    borderColor: "rgba(244,236,222,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  pronunciationInlineButtonText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8
  },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 8
  },
  errorText: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18
  },
  sheetOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "flex-end",
    zIndex: 99
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(26,20,16,0.45)"
  },
  sheetCard: {
    backgroundColor: colors.bone,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32
  },
  sheetGrabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.lineStrong,
    alignSelf: "center",
    marginBottom: 14
  },
  sheetEyebrow: {
    color: colors.terracotta,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 4,
    fontWeight: "700"
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 24,
    marginBottom: 14,
    fontWeight: "600"
  },
  sheetList: {
    gap: 10
  },
  sheetItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line
  },
  sheetItemStatic: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line
  },
  sheetItemRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  sheetItemText: {
    color: colors.ink,
    fontSize: 19,
    lineHeight: 25,
    writingDirection: "rtl"
  },
  sheetItemActionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4
  },
  sheetItemSubText: {
    color: colors.inkMute,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4
  },
  languageOptionStack: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  languageOptionPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.bone,
    alignItems: "center",
    justifyContent: "center"
  },
  languageOptionPillActive: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta
  },
  languageOptionPillText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600"
  },
  languageOptionPillTextActive: {
    color: colors.bone
  },
  sheetItemListen: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(184,70,44,0.1)"
  },
  sheetItemVolume: {
    fontSize: 11,
    color: colors.terracotta,
    marginLeft: 0,
    marginTop: 4,
    fontWeight: "600"
  },
  hintFooterText: {
    fontSize: 12,
    color: colors.inkMute,
    lineHeight: 18,
    marginTop: 14,
    textAlign: "center"
  },
  playHintButton: {
    alignSelf: "center",
    minHeight: 38,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: radii.pill,
    backgroundColor: "rgba(184,70,44,0.1)",
    borderWidth: 1,
    borderColor: "rgba(184,70,44,0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  playHintButtonText: {
    color: colors.terracotta,
    fontSize: 13,
    fontWeight: "600"
  },
  sheetButton: {
    minHeight: 46,
    marginTop: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center"
  },
  sheetButtonText: {
    color: colors.bone,
    fontSize: 15,
    fontWeight: "600"
  },
  correctionCard: {
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    marginVertical: 6
  },
  correctionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8
  },
  correctionLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: colors.inkMute
  },
  correctionTrans: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.terracotta
  },
  correctionTransGreen: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.olive
  },
  correctionHebrewRed: {
    fontSize: 22,
    color: colors.terracotta,
    writingDirection: "rtl"
  },
  correctionHebrewGreen: {
    fontSize: 22,
    color: colors.olive,
    writingDirection: "rtl"
  },
  correctionDesc: {
    fontSize: 14,
    color: colors.inkMute,
    lineHeight: 20,
    marginVertical: 12
  },
  pronunciationScoreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16
  },
  pronunciationScorePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.paperGlass,
    color: colors.inkMute,
    fontSize: 12
  },
  issueDetailStack: {
    gap: 10,
    marginBottom: 18
  },
  issueDetailCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 12,
    backgroundColor: colors.paper
  },
  issueDetailTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4
  },
  issueDetailBody: {
    color: colors.inkMute,
    fontSize: 13,
    lineHeight: 19
  },
  correctionActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8
  },
  correctionBtnGhost: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: "rgba(26,20,16,0.06)",
    alignItems: "center",
    justifyContent: "center"
  },
  correctionBtnGhostText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "500"
  },
  correctionBtnTerra: {
    flex: 2,
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center"
  },
  correctionBtnTerraInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  correctionBtnTerraText: {
    color: colors.bone,
    fontSize: 15,
    fontWeight: "600"
  },
  bottomArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: colors.line
  },
  textComposerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  micSwitchButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: "rgba(26,20,16,0.04)",
    alignItems: "center",
    justifyContent: "center"
  },
  micSwitchButtonText: {
    fontSize: 18,
    color: colors.inkMute
  },
  textComposer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    padding: 0
  },
  inlineHintButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(184,70,44,0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  inlineHintButtonText: {
    color: colors.terracotta,
    fontSize: 13,
    fontWeight: "700"
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center"
  },
  sendButtonDisabled: {
    opacity: 0.6
  },
  sendButtonText: {
    color: colors.bone,
    fontSize: 16
  },
  voiceComposer: {
    alignItems: "center"
  },
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10
  },
  voiceDraftBar: {
    marginTop: 10,
    width: "100%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(26,20,16,0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  voiceDraftText: {
    flex: 1,
    color: colors.inkMute,
    fontSize: 12.5
  },
  voiceDraftSendButton: {
    minHeight: 38,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center"
  },
  typeTextToggle: {
    flexDirection: "row",
    alignItems: "center"
  },
  typeTextToggleText: {
    color: "rgba(26,20,16,0.6)",
    fontSize: 14,
    fontWeight: "500"
  },
  orbButtonContainer: {
    position: "relative"
  },
  lockIndicator: {
    position: "absolute",
    top: -42,
    left: "50%",
    marginLeft: -19,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center"
  },
  lockIndicatorText: {
    color: colors.bone,
    fontSize: 14
  },
  voiceButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5
  },
  voiceButtonRecording: {
    backgroundColor: colors.terracotta
  },
  micIconVector: {
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24
  },
  micPill: {
    width: 8,
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.bone,
    position: "absolute",
    top: 1
  },
  micCup: {
    width: 14,
    height: 9,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderWidth: 2,
    borderColor: colors.bone,
    borderTopWidth: 0,
    position: "absolute",
    top: 6
  },
  micStandLeg: {
    width: 2,
    height: 4,
    backgroundColor: colors.bone,
    position: "absolute",
    bottom: 3
  },
  micStandBase: {
    width: 8,
    height: 1.5,
    backgroundColor: colors.bone,
    position: "absolute",
    bottom: 2.5
  },
  voiceHintButton: {
    alignItems: "center"
  },
  voiceHintLabel: {
    fontSize: 10,
    color: colors.terracotta,
    fontWeight: "500",
    marginTop: 2
  }
});







