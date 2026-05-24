import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { makeRedirectUri } from "expo-auth-session";
import {
  User,
  createUserWithEmailAndPassword,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  OAuthProvider,
  GoogleAuthProvider,
  AuthCredential
} from "firebase/auth";
import { Platform } from "react-native";
import { appConfig } from "./config";
import { auth } from "./firebase";
import { syncUser } from "./api";

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

export function useGooglePrompt() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: appConfig.google.expoClientId || undefined,
    iosClientId: appConfig.google.iosClientId || undefined,
    androidClientId: appConfig.google.androidClientId || undefined,
    webClientId: appConfig.google.webClientId || undefined,
    redirectUri: makeRedirectUri({
      scheme: "daber"
    })
  });

  return { request, response, promptAsync };
}

export async function completeGoogleLogin(idToken: string | null): Promise<User> {
  if (!idToken) {
    throw new Error("Google sign-in did not return an ID token.");
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  await syncUser(result.user);
  return result.user;
}

export async function loginWithGoogleWeb(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  await syncUser(result.user);
  return result.user;
}

export async function loginWithApple(): Promise<User> {
  if (Platform.OS !== "ios") {
    throw new Error("Apple sign-in is only available on iOS devices.");
  }

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL
    ]
  });

  if (!credential.identityToken) {
    throw new Error("Apple sign-in did not return an identity token.");
  }

  const provider = new OAuthProvider("apple.com");
  const firebaseCredential: AuthCredential = provider.credential({
    idToken: credential.identityToken
  });

  const result = await signInWithCredential(auth, firebaseCredential);
  await syncUser(result.user);
  return result.user;
}
