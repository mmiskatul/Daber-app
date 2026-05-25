import {
  User,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { Platform } from "react-native";
import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse
} from "@react-native-google-signin/google-signin";
import { auth } from "./firebase";
import { syncUser } from "./api";
import { appConfig } from "./config";

let googleConfigured = false;

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

  const response = await GoogleSignin.signIn();

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
