export const appConfig = {
  backendBaseUrl: process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:4000",
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
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "",
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "",
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || ""
  }
};

export function hasFirebaseConfig(): boolean {
  const values = Object.values(appConfig.firebase);
  return values.every((value) => Boolean(value) && !value.startsWith("your-"));
}
