import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "./src/firebase";
import { getCurrentUser, getOnboarding, syncUser, getRoadmap } from "./src/api";
import { AuthScreen } from "./src/AuthScreen";
import { ConversationScreen } from "./src/ConversationScreen";
import { HomeScreen } from "./src/HomeScreen";
import { OnboardingScreen } from "./src/OnboardingScreen";
import { colors, radii } from "./src/theme";

type AppStage = "loading" | "auth" | "onboarding" | "home" | "conversation";
type HomeTab = "home" | "scenarios" | "games";

function getActiveConversationStorageKey(uid: string) {
  return `daber_active_conversation:${uid}`;
}

export default function App() {
  const [stage, setStage] = React.useState<AppStage>("loading");
  const [user, setUser] = React.useState<User | null>(null);
  const [showSplash, setShowSplash] = React.useState(true);
  const [activeConversationSessionId, setActiveConversationSessionId] = React.useState("");
  const [homeTab, setHomeTab] = React.useState<HomeTab>("home");

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setActiveConversationSessionId("");
        setStage("auth");
        return;
      }

      setStage("loading");

      try {
        await syncUser(nextUser);
        const profile = await getCurrentUser(nextUser);

        if (profile.onboardingCompleted || profile.onboarding) {
          setActiveConversationSessionId("");
          setHomeTab("home");
          setStage("home");
          return;
        }

        const onboarding = await getOnboarding(nextUser);
        setHomeTab("home");
        setStage(onboarding ? "home" : "onboarding");
      } catch {
        setHomeTab("home");
        setStage("onboarding");
      }
    });

    return unsubscribe;
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      {showSplash ? (
        <SplashScreen onStart={() => setShowSplash(false)} onSignIn={() => setShowSplash(false)} />
      ) : stage === "loading" ? (
        <LoadingScreen />
      ) : !user || stage === "auth" ? (
        <AuthScreen
          onBack={() => setShowSplash(true)}
          onAuthenticated={(nextUser) => {
            setUser(nextUser);
            setStage("loading");
          }}
        />
      ) : stage === "onboarding" ? (
        <OnboardingScreen user={user} onBack={() => setStage("auth")} onDone={() => setStage("home")} />
      ) : stage === "conversation" && activeConversationSessionId ? (
        <ConversationScreen
          user={user}
          sessionId={activeConversationSessionId}
          onReplaceSession={async (nextSessionId) => {
            setActiveConversationSessionId(nextSessionId);
            await AsyncStorage.setItem(getActiveConversationStorageKey(user.uid), nextSessionId);
          }}
          onExit={async () => {
            setActiveConversationSessionId("");
            await AsyncStorage.removeItem(getActiveConversationStorageKey(user.uid));
            setStage("home");
          }}
        />
      ) : (
        <HomeScreen
          user={user}
          initialTab={homeTab}
          onOpenConversation={async (sessionId, returnTab = "home") => {
            setHomeTab(returnTab);
            setActiveConversationSessionId(sessionId);
            await AsyncStorage.setItem(getActiveConversationStorageKey(user.uid), sessionId);
            setStage("conversation");
          }}
        />
      )}
    </>
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.terracotta} />
      </View>
    </SafeAreaView>
  );
}

function SplashScreen({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.splashContainer}>
        <View>
          <Text style={styles.splashEyebrow}>● HEBREW · VOICE-FIRST · AI</Text>
          <Text style={styles.splashTitle}>
            Speak Hebrew{"\n"}
            <Text style={styles.splashTitleItalic}>like you live here.</Text>
          </Text>
          <Text style={styles.splashCopy}>
            Real conversations with Dana, an AI that listens, corrects, and adapts to how you actually speak.
          </Text>
        </View>

        <View style={styles.wordmarkCard}>
          <Text style={styles.wordmarkHe}>דַּבֵּר</Text>
          <Text style={styles.wordmarkLabel}>DAB·BER · to speak</Text>
        </View>

        <View>
          <Pressable style={styles.beginButton} onPress={onStart}>
            <Text style={styles.beginButtonText}>Begin</Text>
            <Text style={styles.beginButtonText}>→</Text>
          </Pressable>
          <Text style={styles.secondaryText}>
            Already learning?{" "}
            <Text style={styles.secondaryLink} onPress={onSignIn}>
              Sign in
            </Text>
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  splashContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 90,
    paddingBottom: 40,
    justifyContent: "space-between"
  },
  splashEyebrow: {
    marginBottom: 28,
    color: colors.terracotta,
    fontSize: 11,
    letterSpacing: 2
  },
  splashTitle: {
    fontSize: 52,
    lineHeight: 55,
    color: colors.ink,
    marginBottom: 24
  },
  splashTitleItalic: {
    fontStyle: "italic"
  },
  splashCopy: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.inkMute,
    maxWidth: 320
  },
  wordmarkCard: {
    alignSelf: "center",
    marginVertical: 20,
    paddingVertical: 24,
    paddingHorizontal: 28,
    borderRadius: radii.lg,
    backgroundColor: colors.paperGlass,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    width: "100%",
    maxWidth: 320
  },
  wordmarkHe: {
    fontSize: 44,
    fontWeight: "500",
    color: colors.ink,
    marginBottom: 6
  },
  wordmarkLabel: {
    color: colors.inkMute,
    fontSize: 11,
    letterSpacing: 2
  },
  beginButton: {
    width: "100%",
    minHeight: 58,
    borderRadius: radii.pill,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8
  },
  beginButtonText: {
    color: colors.bone,
    fontSize: 16,
    fontWeight: "600"
  },
  secondaryText: {
    marginTop: 16,
    textAlign: "center",
    fontSize: 14,
    color: colors.inkMute
  },
  secondaryLink: {
    color: colors.ink,
    textDecorationLine: "underline"
  }
});
