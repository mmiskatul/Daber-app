import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../theme";
import { AudioLevelSnapshot } from "./audioLevelTracker";

const AVATAR_CARD_SOURCE = require("../../app/assets/skye-card.png");
const AVATAR_STUDIO_SOURCE = require("../../app/assets/skye-studio.png");

export const ILLUSTRATED_AVATAR_HINT_ITEMS = [
  {
    he: "\u05e9\u05dc\u05d5\u05dd, \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d4\u05ea\u05d7\u05d9\u05dc \u05d1\u05e9\u05d9\u05d7\u05d4 \u05e4\u05e9\u05d5\u05d8\u05d4?",
    en: "Hi, can we start with a simple conversation?"
  },
  {
    he: "\u05d0\u05e0\u05d9 \u05dc\u05d5\u05de\u05d3\u05ea \u05e2\u05d1\u05e8\u05d9\u05ea. \u05ea\u05d5\u05db\u05dc\u05d9 \u05dc\u05ea\u05e7\u05df \u05d0\u05d5\u05ea\u05d9 \u05d1\u05e2\u05d3\u05d9\u05e0\u05d5\u05ea?",
    en: "I'm learning Hebrew. Can you correct me gently?"
  },
  {
    he: "\u05d0\u05d9\u05da \u05d4\u05d9\u05d9\u05ea \u05d0\u05d5\u05de\u05e8\u05ea \u05d0\u05ea \u05d6\u05d4 \u05db\u05de\u05d5 \u05d3\u05d5\u05d1\u05e8\u05ea \u05d8\u05d1\u05e2\u05d9\u05ea?",
    en: "How would you say this naturally?"
  }
] as const;

type VoiceRtcState =
  | "idle"
  | "connecting"
  | "connected"
  | "listening"
  | "processing"
  | "assistantSpeaking"
  | "reconnecting"
  | "failed";

type AvatarProps = {
  voiceName: string;
  speakingActive: boolean;
  listeningActive: boolean;
  rtcState: VoiceRtcState;
  audioLevels: AudioLevelSnapshot;
};

export function IllustratedAvatarCard({
  voiceName,
  speakingActive,
  listeningActive,
  rtcState,
  audioLevels,
  onMinimize,
  onOpenStudio
}: AvatarProps & {
  onMinimize: () => void;
  onOpenStudio?: () => void;
}) {
  const { blinkAnim, swayAnim, pulseAnim } = useAvatarMotion(speakingActive, listeningActive);
  const statusLabel =
    rtcState === "assistantSpeaking"
      ? "VOICE LIVE"
      : speakingActive
        ? "SPEAKING"
        : listeningActive
          ? "LISTENING"
          : rtcState === "processing"
            ? "THINKING"
            : rtcState === "connected" || rtcState === "listening"
              ? "RTC READY"
              : rtcState === "connecting" || rtcState === "reconnecting"
                ? "CONNECTING"
                : "IDLE";

  const signalBars = [
    Math.max(0.18, audioLevels.inputLevel * 0.9),
    Math.max(0.12, Math.max(audioLevels.inputLevel, audioLevels.outputLevel) * 0.95),
    Math.max(0.16, audioLevels.outputLevel),
    Math.max(0.12, audioLevels.outputLevel * 0.72)
  ];
  const translateX = swayAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-9, 9]
  });
  const translateY = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10]
  });
  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.01, 1.05]
  });
  const tilt = swayAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-0.8deg", "0.8deg"]
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardGlow} />
      <Animated.Image
        source={AVATAR_CARD_SOURCE}
        resizeMode="cover"
        style={[
          styles.cardImage,
          {
            transform: [{ translateX }, { translateY }, { scale }, { rotate: tilt }]
          }
        ]}
      />
      <View style={styles.cardShade} />
      <BlinkOverlay blinkAnim={blinkAnim} variant="card" />
      <View style={styles.cardShadow} />

      <Pressable onPress={onMinimize} style={styles.topLeftControl}>
        <View style={styles.expandIcon}>
          <View style={[styles.cornerH, { left: 0, top: 0 }]} />
          <View style={[styles.cornerV, { left: 0, top: 0 }]} />
          <View style={[styles.cornerH, { right: 0, top: 0 }]} />
          <View style={[styles.cornerV, { right: 0, top: 0 }]} />
          <View style={[styles.cornerH, { left: 0, bottom: 0 }]} />
          <View style={[styles.cornerV, { left: 0, bottom: 0 }]} />
          <View style={[styles.cornerH, { right: 0, bottom: 0 }]} />
          <View style={[styles.cornerV, { right: 0, bottom: 0 }]} />
        </View>
      </Pressable>

      <View style={styles.topRightMeta}>
        <View
          style={[
            styles.statusDot,
            speakingActive ? styles.statusDotSpeaking : listeningActive ? styles.statusDotListening : null
          ]}
        />
        <Text style={styles.statusName}>{voiceName.toUpperCase()}</Text>
        <View style={styles.statusDivider} />
        <Text style={styles.statusMode}>{statusLabel}</Text>
      </View>

      <View style={styles.signalRack}>
        {signalBars.map((level, index) => (
          <View key={`signal-${index}`} style={styles.signalTrack}>
            <View
              style={[
                styles.signalFill,
                {
                  height: `${Math.round(level * 100)}%`,
                  opacity: 0.38 + level * 0.62
                }
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.bottomRightControls}>
        <Pressable style={styles.smallControl}>
          <View style={styles.speakerBox} />
        </Pressable>
        <Pressable style={styles.smallControl} onPress={onOpenStudio}>
          <View style={styles.cameraBox} />
        </Pressable>
      </View>
    </View>
  );
}

export function IllustratedAvatarStudio({
  voiceName,
  speakingActive,
  listeningActive,
  rtcState,
  audioLevels,
  caption
}: AvatarProps & {
  caption: string;
}) {
  const { blinkAnim, swayAnim, pulseAnim } = useAvatarMotion(speakingActive, listeningActive);
  const modeLabel =
    rtcState === "assistantSpeaking"
      ? "SPEAKING"
      : listeningActive
        ? "LISTENING"
        : rtcState === "processing"
          ? "THINKING"
          : rtcState === "connecting" || rtcState === "reconnecting"
            ? "CONNECTING"
            : "READY";
  const micGlow = Math.max(audioLevels.inputLevel, audioLevels.outputLevel);
  const translateX = swayAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-10, 10]
  });
  const translateY = swayAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [8, -8]
  });
  const scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1.02, 1.08]
  });
  const rotate = swayAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-0.7deg", "0.7deg"]
  });

  return (
    <View style={styles.studioCanvas}>
      <View style={styles.studioGlow} />
      <Animated.Image
        source={AVATAR_STUDIO_SOURCE}
        resizeMode="cover"
        style={[
          styles.studioImage,
          {
            transform: [{ translateX }, { translateY }, { scale }, { rotate }]
          }
        ]}
      />
      <View style={styles.studioVignette} />
      <BlinkOverlay blinkAnim={blinkAnim} variant="studio" />

      <View style={styles.studioNamePill}>
        <View
          style={[
            styles.statusDot,
            speakingActive ? styles.statusDotSpeaking : listeningActive ? styles.statusDotListening : null
          ]}
        />
        <Text style={styles.studioNameText}>{voiceName}</Text>
      </View>

      <View style={styles.studioCaptionWrap}>
        <Text style={styles.studioCaption}>{caption}</Text>
      </View>

      <View style={styles.studioBottomDock}>
        <Text style={styles.studioMode}>{modeLabel}</Text>
        <View
          style={[
            styles.studioMicButton,
            {
              shadowOpacity: 0.22 + micGlow * 0.35,
              transform: [{ scale: 1 + micGlow * 0.08 }]
            }
          ]}
        >
          <View style={styles.micPill} />
          <View style={styles.micCup} />
          <View style={styles.micStem} />
          <View style={styles.micBase} />
        </View>
        <Text style={styles.studioDockText}>
          {listeningActive ? "Speak naturally while the microphone is active." : "Open the microphone to begin."}
        </Text>
      </View>
    </View>
  );
}

function useAvatarMotion(speakingActive: boolean, listeningActive: boolean) {
  const blinkAnim = React.useRef(new Animated.Value(0)).current;
  const swayAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(2400),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 90,
          useNativeDriver: false
        }),
        Animated.timing(blinkAnim, {
          toValue: 0,
          duration: 120,
          useNativeDriver: false
        })
      ])
    );
    blinkLoop.start();
    return () => blinkLoop.stop();
  }, [blinkAnim]);

  React.useEffect(() => {
    const swayLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(swayAnim, { toValue: 0.9, duration: 1800, useNativeDriver: false }),
        Animated.timing(swayAnim, { toValue: -0.7, duration: 2100, useNativeDriver: false }),
        Animated.timing(swayAnim, { toValue: 0, duration: 1600, useNativeDriver: false })
      ])
    );
    swayLoop.start();
    return () => swayLoop.stop();
  }, [swayAnim]);

  React.useEffect(() => {
    const target = speakingActive ? 1 : listeningActive ? 0.72 : 0.3;
    Animated.timing(pulseAnim, {
      toValue: target,
      duration: 260,
      useNativeDriver: false
    }).start();
  }, [listeningActive, pulseAnim, speakingActive]);

  return { blinkAnim, swayAnim, pulseAnim };
}

function BlinkOverlay({
  blinkAnim,
  variant
}: {
  blinkAnim: Animated.Value;
  variant: "card" | "studio";
}) {
  const eyelidHeight = blinkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, variant === "studio" ? 22 : 12]
  });

  return (
    <View pointerEvents="none" style={styles.blinkLayer}>
      <Animated.View
        style={[
          styles.blinkLid,
          variant === "studio" ? styles.blinkStudioLeft : styles.blinkCardLeft,
          { height: eyelidHeight }
        ]}
      />
      <Animated.View
        style={[
          styles.blinkLid,
          variant === "studio" ? styles.blinkStudioRight : styles.blinkCardRight,
          { height: eyelidHeight }
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 4 / 3,
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#D39B57",
    borderWidth: 1,
    borderColor: "rgba(255,244,228,0.22)"
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,182,140,0.18)"
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: "112%",
    height: "112%",
    left: "-6%",
    top: "-6%"
  },
  cardShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(16,10,8,0.1)"
  },
  cardShadow: {
    position: "absolute",
    left: "16%",
    right: "16%",
    bottom: 20,
    height: 26,
    borderRadius: 999,
    backgroundColor: "rgba(58,24,16,0.16)"
  },
  topLeftControl: {
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
  expandIcon: {
    width: 14,
    height: 14,
    position: "relative"
  },
  cornerH: {
    position: "absolute",
    width: 5,
    height: 1.5,
    backgroundColor: colors.bone
  },
  cornerV: {
    position: "absolute",
    width: 1.5,
    height: 5,
    backgroundColor: colors.bone
  },
  topRightMeta: {
    position: "absolute",
    top: 12,
    right: 12,
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: radii.pill,
    backgroundColor: "rgba(26,20,16,0.48)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.6)"
  },
  statusDotSpeaking: {
    backgroundColor: colors.gold
  },
  statusDotListening: {
    backgroundColor: "#7DD3A3"
  },
  statusName: {
    color: colors.bone,
    fontSize: 9,
    letterSpacing: 1
  },
  statusDivider: {
    width: 1,
    height: 10,
    backgroundColor: "rgba(244,236,222,0.24)"
  },
  statusMode: {
    color: "rgba(244,236,222,0.86)",
    fontSize: 8,
    letterSpacing: 0.9
  },
  signalRack: {
    position: "absolute",
    right: 14,
    top: "34%",
    bottom: "24%",
    width: 22,
    justifyContent: "flex-end",
    gap: 4
  },
  signalTrack: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "rgba(20,16,14,0.18)",
    overflow: "hidden",
    justifyContent: "flex-end"
  },
  signalFill: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.bone
  },
  bottomRightControls: {
    position: "absolute",
    right: 14,
    bottom: 14,
    flexDirection: "row",
    gap: 10
  },
  smallControl: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(26,20,16,0.4)",
    alignItems: "center",
    justifyContent: "center"
  },
  speakerBox: {
    width: 12,
    height: 9,
    borderRadius: 3,
    backgroundColor: colors.bone
  },
  cameraBox: {
    width: 14,
    height: 10,
    borderRadius: 3,
    backgroundColor: colors.bone
  },
  studioCanvas: {
    flex: 1,
    borderRadius: 34,
    overflow: "hidden",
    backgroundColor: "#0a0909",
    justifyContent: "flex-end"
  },
  studioGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(132,92,255,0.14)"
  },
  studioImage: {
    ...StyleSheet.absoluteFillObject,
    width: "108%",
    height: "108%",
    left: "-4%",
    top: "-4%"
  },
  studioVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.16)"
  },
  studioNamePill: {
    position: "absolute",
    top: 18,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(15,12,12,0.48)"
  },
  studioNameText: {
    color: colors.bone,
    fontSize: 14,
    fontWeight: "700"
  },
  studioCaptionWrap: {
    paddingHorizontal: 22,
    paddingBottom: 120
  },
  studioCaption: {
    color: colors.bone,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    backgroundColor: "rgba(26,20,16,0.72)",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24
  },
  studioBottomDock: {
    alignItems: "center",
    paddingBottom: 36,
    paddingHorizontal: 20
  },
  studioMode: {
    color: colors.bone,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 14
  },
  studioMicButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#9E7BFF",
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    marginBottom: 14
  },
  studioDockText: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    textAlign: "center"
  },
  micPill: {
    width: 22,
    height: 28,
    borderRadius: 12,
    backgroundColor: "#111"
  },
  micCup: {
    position: "absolute",
    top: 18,
    width: 30,
    height: 20,
    borderWidth: 3,
    borderTopWidth: 0,
    borderColor: "#111",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16
  },
  micStem: {
    position: "absolute",
    top: 42,
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: "#111"
  },
  micBase: {
    position: "absolute",
    top: 58,
    width: 26,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#111"
  },
  blinkLayer: {
    ...StyleSheet.absoluteFillObject
  },
  blinkLid: {
    position: "absolute",
    backgroundColor: "rgba(244,193,165,0.92)",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16
  },
  blinkCardLeft: {
    left: "40.5%",
    top: "35.5%",
    width: "7%"
  },
  blinkCardRight: {
    left: "52.7%",
    top: "35.5%",
    width: "7%"
  },
  blinkStudioLeft: {
    left: "41.7%",
    top: "34.1%",
    width: "6.8%"
  },
  blinkStudioRight: {
    left: "51.6%",
    top: "34.1%",
    width: "6.8%"
  }
});
