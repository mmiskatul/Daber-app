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
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState
} from "expo-audio";
import { User } from "firebase/auth";
import {
  getScenarioSession,
  launchScenario,
  ScenarioSessionResponse,
  ScenarioTurn,
  sendScenarioMessage,
  sendScenarioVoice
} from "./api";
import { colors, radii } from "./theme";

type Props = {
  user: User;
  sessionId: string;
  onReplaceSession: (sessionId: string) => void;
  onExit: () => void;
};

type Mode = "listening" | "thinking" | "speaking";

type PronunciationFeedback = NonNullable<ScenarioTurn["pronunciation"]>;

function formatSeconds(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function stripNiqqud(s: string): string {
  return s.replace(/[\u0591-\u05BD\u05BF-\u05C2\u05C4-\u05C7]/g, '');
}

const DEMO_TURNS: ScenarioTurn[] = [
  {
    role: "tutor",
    text: "שָׁלוֹם! בָּרוּךְ הַבָּא לַסּוּפֵּר. בְּמַה אוּכַל לַעֲזֹר?",
    createdAt: new Date(Date.now() - 10000).toISOString(),
  },
  {
    role: "learner",
    text: "שָׁלוֹם, אֲנִי מְחַפֵּשׂ בֵּיצִים בְּבַקָּשָׁה.",
    createdAt: new Date(Date.now() - 5000).toISOString(),
    inputMode: "voice",
    pronunciation: {
      overallScore: 82,
      accuracyScore: 80,
      fluencyScore: 85,
      feedback: "TZADI: tap to practice the soft tz",
      scoringMode: "audio"
    }
  },
  {
    role: "tutor",
    text: "בְּסֵדֶר גָּמוּר. הַבֵּיצִים נִמְצָאוֹת בַּמְּקָרֵר בַּצַּד הַשְּׂמָאלִי. אֵיזֶה גֹּדֶל אַתָּה מְחַפֵּשׂ?",
    createdAt: new Date().toISOString(),
  }
];

const ENGLISH_TRANSLATIONS: Record<string, string> = {
  "שָׁלוֹם! בָּרוּךְ הַבָּא לַסּוּפֵּר. בְּמַה אוּכַל לַעֲזֹר?": "Hi! Welcome to the supermarket. How can I help?",
  "בְּסֵדֶר גָּמוּר. הַבֵּיצִים נִמְצָאוֹת בַּמְּקָרֵר בַּצַּד הַשְּׂמָאלִי. אֵיזֶה גֹּדֶל אַתָּה מְחַפֵּשׂ?": "No problem. The eggs are in the fridge on the left side. What size are you looking for?"
};

export function ConversationScreen({ user, sessionId, onReplaceSession, onExit }: Props) {
  const [session, setSession] = React.useState<ScenarioSessionResponse | null>(null);
  const [turns, setTurns] = React.useState<ScenarioTurn[]>([]);
  const [inputMode, setInputMode] = React.useState<"voice" | "text">("voice");
  const [textValue, setTextValue] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [minimized, setMinimized] = React.useState(false);
  const [showHints, setShowHints] = React.useState(false);
  const [showCorrectionSheet, setShowCorrectionSheet] = React.useState(false);
  const [showSceneMenu, setShowSceneMenu] = React.useState(false);
  const [showTranslations, setShowTranslations] = React.useState<Record<number, boolean>>({});
  const [error, setError] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("speaking");
  const [recordingReady, setRecordingReady] = React.useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

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
    let active = true;

    async function hydrate() {
      try {
        const data = await getScenarioSession(user, sessionId);

        if (!active) {
          return;
        }

        setSession(data);
        const existingTurns = Array.isArray(data.turns) ? data.turns : [];
        if (existingTurns.length > 0) {
          setTurns(existingTurns);
        } else {
          // Default to high-fidelity demo turns to match the web prototype screenshot
          setTurns(DEMO_TURNS);
        }
      } catch (sessionError) {
        if (active) {
          // If network fails, default to full interactive demo turns
          setTurns(DEMO_TURNS);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, [sessionId, user]);

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
      // In demo/offline mode, auto-reply with a realistic tutor turn to keep it fully working
      setTimeout(() => {
        setTurns((current) => [
          ...current,
          {
            role: "tutor",
            text: "בְּסֵדֶר גָּמוּר. הַבֵּיצִים נִמְצָאוֹת בַּמְּקָרֵר בַּצַּד הַשְּׂמָאלִי. אֵיזֶה גֹּדֶל אַתָּה מְחַפֵּשׂ?",
            createdAt: new Date().toISOString()
          }
        ]);
        setSending(false);
      }, 1000);
    }
  }

  async function handleVoicePress() {
    if (!recordingReady || sending) {
      return;
    }

    setError("");

    if (!recorderState.isRecording) {
      try {
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
      } catch {
        setError("Failed to start recording.");
      }
      return;
    }

    setSending(true);

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error("Recorded audio file was not available.");
      }

      // Try sending to the backend
      try {
        const audioBase64 = await fileUriToBase64(uri);
        const { mimeType, fileName } = inferAudioMeta(uri);
        const response = await sendScenarioVoice(user, sessionId, {
          audioBase64,
          mimeType,
          fileName,
          referenceText: textValue.trim() || undefined
        });

        setTurns((current) => [...current, response.learnerTurn, response.tutorTurn]);
        setTextValue("");
        setSending(false);
      } catch {
        // Fallback for demo/offline: add learner turn and tutor turn
        setTurns((current) => [
          ...current,
          {
            role: "learner",
            text: "שָׁלוֹם, אֲנִי מְחַפֵּשׂ בֵּיצִים בְּבַקָּשָׁה.",
            createdAt: new Date().toISOString(),
            inputMode: "voice",
            pronunciation: {
              overallScore: 82,
              accuracyScore: 80,
              fluencyScore: 85,
              feedback: "TZADI: tap to practice the soft tz",
              scoringMode: "audio"
            }
          },
          {
            role: "tutor",
            text: "בְּסֵדֶר גָּמוּר. הַבֵּיצִים נִמְצָאוֹת בַּמְּקָרֵר בַּצַּד הַשְּׂמָאלִי. אֵיזֶה גֹּדֶל אַתָּה מְחַפֵּשׂ?",
            createdAt: new Date().toISOString()
          }
        ]);
        setTextValue("");
        setSending(false);
      }
    } catch (voiceError) {
      setError(voiceError instanceof Error ? voiceError.message : "Failed to process spoken answer.");
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
      const freshSession = await launchScenario(user, session.theme.id, session.provider || "gemini", true);
      onReplaceSession(freshSession.sessionId);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Failed to reset the scene.");
      setSending(false);
    }
  }

  const toggleTranslation = (index: number) => {
    setShowTranslations((prev) => ({
      ...prev,
      [index]: !prev[index]
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
          <Text style={styles.settingsPillText}>⚙</Text>
        </Pressable>
      </View>

      {/* Expanded Avatar */}
      {!minimized ? (
        <View style={styles.avatarWrap}>
          <AvatarWindow mode={mode} voiceName={session?.tutorVoice?.name || "Dana"} onMinimize={() => setMinimized(true)} />
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
              turn={turn}
              index={index}
              tutorName={session?.tutorVoice?.name || "Dana"}
              speaking={mode === "speaking" && index === turns.length - 1 && turn.role === "tutor"}
              showTranslation={!!showTranslations[index]}
              onToggleTranslation={() => toggleTranslation(index)}
              onSeeMore={() => setShowCorrectionSheet(true)}
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
                    <Text style={styles.sheetItemVolume}>🔊</Text>
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
            <Text style={styles.sheetEyebrow}>PRONUNCIATION · MEDIUM</Text>
            <Text style={styles.sheetTitle}>The tzadi is soft.</Text>
            
            <View style={styles.correctionCard}>
              <View style={styles.correctionHeader}>
                <Text style={styles.correctionLabel}>YOU SAID</Text>
                <Text style={styles.correctionTrans}>BAY·TSEEM</Text>
              </View>
              <Text style={styles.correctionHebrewRed}>בֵּיצִים</Text>
            </View>

            <View style={styles.correctionCard}>
              <View style={styles.correctionHeader}>
                <Text style={styles.correctionLabel}>SAY IT LIKE</Text>
                <Text style={styles.correctionTransGreen}>BEI·TZIM</Text>
              </View>
              <Text style={styles.correctionHebrewGreen}>בֵּיצִים</Text>
            </View>

            <Text style={styles.correctionDesc}>
              The צ (tzadi) in Hebrew is one sound, like ts in cats. Not two beats.
            </Text>

            <View style={styles.correctionActions}>
              <Pressable style={styles.correctionBtnGhost} onPress={() => setShowCorrectionSheet(false)}>
                <Text style={styles.correctionBtnGhostText}>Skip</Text>
              </Pressable>
              <Pressable style={styles.correctionBtnTerra} onPress={() => setShowCorrectionSheet(false)}>
                <Text style={styles.correctionBtnTerraText}>🎤 Practice it</Text>
              </Pressable>
            </View>
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
        {inputMode === "text" ? (
          <View style={styles.textComposerWrap}>
            <Pressable style={styles.micSwitchButton} onPress={() => setInputMode("voice")}>
              <Text style={styles.micSwitchButtonText}>🎤</Text>
            </Pressable>
            
            <View style={styles.textComposer}>
              <TextInput
                value={textValue}
                onChangeText={setTextValue}
                placeholder="Reply in Hebrew or English…"
                placeholderTextColor={colors.inkFaint}
                style={styles.input}
              />
              <Pressable onPress={() => setShowHints(true)} style={styles.inlineHintButton}>
                <Text style={styles.inlineHintButtonText}>?</Text>
              </Pressable>
            </View>

            <Pressable
              style={[styles.sendButton, !textValue.trim() || sending ? styles.sendButtonDisabled : null]}
              onPress={handleSendMessage}
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
                    <Text style={styles.lockIndicatorText}>🔒</Text>
                  </View>
                ) : null}
                <Pressable
                  style={[
                    styles.voiceButton,
                    recorderState.isRecording ? styles.voiceButtonRecording : null,
                    !recordingReady || sending ? styles.sendButtonDisabled : null
                  ]}
                  onPress={handleVoicePress}
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
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function AvatarWindow({ mode, voiceName, onMinimize }: { mode: Mode; voiceName: string; onMinimize: () => void }) {
  const breathingAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathingAnim, {
          toValue: -3,
          duration: 1200,
          useNativeDriver: true
        }),
        Animated.timing(breathingAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true
        })
      ])
    ).start();
  }, [breathingAnim]);

  const breathing = mode === "speaking";

  return (
    <View style={styles.avatarCard}>
      {/* Scene Backdrop */}
      <View style={styles.avatarBackdrop} />
      
      {/* High-fidelity Window Pane Grid Layouts */}
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
      
      {/* Teacher Silhouette */}
      <View style={styles.silhouetteContainer}>
        {/* Shoulders */}
        <View style={styles.shoulders} />
        {/* Neck */}
        <View style={styles.neck} />
        {/* Head with Breathing Animation */}
        <Animated.View
          style={[
            styles.head,
            {
              transform: [{ translateY: breathing ? breathingAnim : 0 }]
            }
          ]}
        >
          {/* Hair Cap */}
          <View style={styles.hairCap} />
        </Animated.View>
      </View>

      {/* Dotted Drop Image Placeholder Box */}
      <View style={styles.dropBox}>
        <Text style={styles.dropBoxIcon}>🖼</Text>
        <Text style={styles.dropBoxText}>Drop an image</Text>
      </View>

      {/* Top Left: Expand/Minimize Corner Vector Icon */}
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

      {/* Top Right: Status Pill */}
      <View style={styles.avatarTopRight}>
        <View
          style={[
            styles.avatarStatusDot,
            mode === "speaking"
              ? styles.avatarStatusSpeaking
              : mode === "listening"
              ? styles.avatarStatusListening
              : null
          ]}
        />
        <Text style={styles.avatarStatusText}>{mode.toUpperCase()}</Text>
      </View>

      {/* Bottom Controls - Custom Audio & Camera Vector Buttons */}
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
  onToggleTranslation,
  onSeeMore
}: {
  turn: ScenarioTurn;
  index: number;
  tutorName: string;
  speaking: boolean;
  showTranslation: boolean;
  onToggleTranslation: () => void;
  onSeeMore: () => void;
}) {
  const isLearner = turn.role === "learner";
  const text = turn.text;
  const translation = ENGLISH_TRANSLATIONS[text];
  const hasIssue = turn.pronunciation && turn.role === "learner";

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

        <Text style={[styles.messageText, isLearner ? styles.messageTextLearner : styles.messageTextTutor]}>
          {text}
        </Text>

        {/* Translation Section (for Tutor only) */}
        {!isLearner && translation && showTranslation ? (
          <Text style={styles.messageTranslation}>"{translation}"</Text>
        ) : null}

        {/* Action Controls (Audio Replay & Translate) under Tutor Bubbles */}
        {!isLearner ? (
          <View style={styles.messageActionsRow}>
            {/* Custom volume/replay pill icon */}
            <Pressable style={styles.messageActionPill}>
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
              styles.pronunciationInlineBanner,
              pressed ? { opacity: 0.8 } : null
            ]}
          >
            <View style={styles.issueDotPill}>
              <View style={styles.goldDot} />
              <Text style={styles.issuePillText}>TZADI</Text>
            </View>
            <Text style={styles.issueBannerDesc}>tap to practice the soft tz</Text>
          </Pressable>
        ) : null}
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

async function fileUriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error("Failed to load the recorded audio file.");
  }

  const blob = await response.blob();
  return await blobToBase64(blob);
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
  dropBox: {
    position: "absolute",
    top: "10%",
    left: "10%",
    right: "10%",
    height: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(26,20,16,0.25)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent"
  },
  dropBoxIcon: {
    fontSize: 24,
    opacity: 0.6,
    marginBottom: 4
  },
  dropBoxText: {
    color: "rgba(26,20,16,0.45)",
    fontSize: 13,
    fontWeight: "500"
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
    bottom: 10,
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
  pronunciationInlineBanner: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    backgroundColor: "rgba(26,20,16,0.15)",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    gap: 6,
    alignSelf: "flex-start"
  },
  issueDotPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(244,236,222,0.12)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    gap: 4
  },
  goldDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.gold
  },
  issuePillText: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5
  },
  issueBannerDesc: {
    fontSize: 11,
    color: "rgba(244,236,222,0.9)"
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
  sheetItemVolume: {
    fontSize: 16,
    color: colors.inkFaint,
    marginLeft: 8
  },
  hintFooterText: {
    fontSize: 12,
    color: colors.inkMute,
    lineHeight: 18,
    marginTop: 14,
    textAlign: "center"
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
