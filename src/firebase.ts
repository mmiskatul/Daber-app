import { initializeApp, getApps } from "firebase/app";
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider
} from "firebase/auth";
import { appConfig } from "./config";

const firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(appConfig.firebase);

export const auth: Auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider("apple.com");
