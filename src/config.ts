import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

const GOOGLE_DEFAULTS = {
  webClientId: "219426011241-ecl68oh2n8pae7kdti1t8v3emsk4nddg.apps.googleusercontent.com",
  androidClientId: "219426011241-elum17f6r24hbnkru7sb1cl2h89m6c1b.apps.googleusercontent.com",
  iosClientId: "219426011241-ngfiip2veu0ne9eniefebr7a5gr6069j.apps.googleusercontent.com"
};

function getScriptHost(): string | null {
  const legacyManifest = Constants.manifest as { debuggerHost?: string } | null | undefined;
  const expoHostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    legacyManifest?.debuggerHost;

  if (expoHostUri && typeof expoHostUri === "string") {
    return expoHostUri.split(":")[0] || null;
  }

  const sourceCode = NativeModules.SourceCode;
  const scriptURL = sourceCode?.scriptURL ?? sourceCode?.getConstants?.().scriptURL;

  if (!scriptURL || typeof scriptURL !== "string") {
    return null;
  }

  try {
    return new URL(scriptURL).hostname;
  } catch {
    return null;
  }
}

function getDefaultBackendBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_BASE_URL;

  if (envUrl) {
    return envUrl;
  }

  // Android emulators cannot reach the host machine through localhost.
  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  const scriptHost = getScriptHost();

  if (scriptHost && scriptHost !== "localhost" && scriptHost !== "127.0.0.1") {
    return `http://${scriptHost}:4000`;
  }

  return "http://localhost:4000";
}

export const appConfig = {
  backendBaseUrl: getDefaultBackendBaseUrl(),
  voiceRtcEnabled: process.env.EXPO_PUBLIC_VOICE_RTC_ENABLED === "true",
  voiceGatewayBaseUrl: process.env.EXPO_PUBLIC_VOICE_GATEWAY_BASE_URL || "",
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || ""
  },
  google: {
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || "",
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || GOOGLE_DEFAULTS.iosClientId,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || GOOGLE_DEFAULTS.androidClientId,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || GOOGLE_DEFAULTS.webClientId
  }
};

export function hasFirebaseConfig(): boolean {
  const values = Object.values(appConfig.firebase);
  return values.every((value) => Boolean(value) && !value.startsWith("your-"));
}
