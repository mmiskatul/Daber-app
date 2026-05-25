import React from "react";
import { StatusBar } from "expo-status-bar";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "./src/firebase";
import { getOnboarding } from "./src/api";
import { AuthScreen } from "./src/AuthScreen";
import { HomeScreen } from "./src/HomeScreen";
import { OnboardingScreen } from "./src/OnboardingScreen";

type AppStage = "loading" | "auth" | "onboarding" | "home";

export default function App() {
  const [stage, setStage] = React.useState<AppStage>("loading");
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setStage("auth");
        return;
      }

      try {
        const onboarding = await getOnboarding(nextUser);
        setStage(onboarding ? "home" : "onboarding");
      } catch {
        setStage("onboarding");
      }
    });

    return unsubscribe;
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      {!user || stage === "auth" || stage === "loading" ? (
        <AuthScreen
          onAuthenticated={(nextUser) => {
            setUser(nextUser);
            setStage("onboarding");
          }}
        />
      ) : stage === "onboarding" ? (
        <OnboardingScreen user={user} onDone={() => setStage("home")} />
      ) : (
        <HomeScreen user={user} />
      )}
    </>
  );
}
