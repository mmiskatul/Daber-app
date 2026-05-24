import { initializeApp, getApps } from "firebase/app";
import {
  Auth,
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  GoogleAuthProvider,
  OAuthProvider
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { appConfig } from "./config";

const firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(appConfig.firebase);

let authInstance: Auth;

try {
  authInstance = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch {
  authInstance = getAuth(firebaseApp);
}

export const auth = authInstance;
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider("apple.com");
