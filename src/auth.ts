import {
  User,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { Platform } from "react-native";
import Constants from "expo-constants";
import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse
} from "@react-native-google-signin/google-signin";
import { auth } from "./firebase";
import { syncUser } from "./api";
import { appConfig } from "./config";

let googleConfigured = false;

export function canUseAppleSignIn(): boolean {
  return Platform.OS === "ios" && Constants.executionEnvironment !== "storeClient";
}

function configureGoogleSignIn(): void {
  if (googleConfigured || Platform.OS === "web") {
    return;
  }

  if (!appConfig.google.webClientId) {
    throw new Error("Google Sign-In is missing the web client ID in the Expo environment.");
  }

  GoogleSignin.configure({
    webClientId: appConfig.google.webClientId,
    iosClientId: appConfig.google.iosClientId || undefined,
    offlineAccess: false
  });

  googleConfigured = true;
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await syncUser(result.user);
  return result.user;
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, password);
  await syncUser(result.user);
  return result.user;
}

export async function loginWithGoogle(): Promise<User> {
  if (Platform.OS === "web") {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await syncUser(result.user);
    return result.user;
  }

  configureGoogleSignIn();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  let response;

  try {
    response = await GoogleSignin.signIn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("DEVELOPER_ERROR")) {
      throw new Error(
        "Google Sign-In Android config mismatch. Add this app signing SHA-1 to Firebase/Google Cloud OAuth for package com.daber.app, then download a fresh google-services.json. Current debug SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25."
      );
    }

    throw error;
  }

  if (isCancelledResponse(response)) {
    throw new Error("Google sign-in was cancelled.");
  }

  if (!isSuccessResponse(response)) {
    throw new Error("Google sign-in did not complete successfully.");
  }

  const idToken = response.data.idToken;

  if (!idToken) {
    throw new Error("Google sign-in did not return an ID token.");
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  await syncUser(result.user);
  return result.user;
}

export async function loginWithApple(): Promise<User> {
  throw new Error("Apple sign-in is not enabled in the current Expo runtime. Use email login or a dedicated iOS native setup.");
}
