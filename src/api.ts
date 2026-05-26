import { User } from "firebase/auth";
import { appConfig } from "./config";

type ApiSuccess<T> = {
  status: true;
  message: string;
  details?: T;
};

type ApiError = {
  status: false;
  message: string;
  details?: {
    code?: string;
    cause?: unknown;
  };
};

export type SyncUserResponse = {
  uid: string;
  isNewUser: boolean;
};

export type OnboardingPayload = {
  native: string;
  level: string;
  goal: string;
  voice: string;
};

export type UserProfile = {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoURL: string | null;
  provider: string | null;
  onboardingCompleted?: boolean;
  onboarding?: OnboardingPayload;
  isNewUser?: boolean;
};

async function request<T>(path: string, token: string, body?: unknown, method = "POST"): Promise<ApiSuccess<T>> {
  let response: Response;

  try {
    response = await fetch(`${appConfig.backendBaseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error(`Network request failed. Backend URL: ${appConfig.backendBaseUrl}`);
  }

  const payload = (await response.json()) as ApiSuccess<T> | ApiError;

  if (!response.ok || payload.status !== true) {
    throw new Error(payload.message || "Backend request failed.");
  }

  return payload;
}

export async function syncUser(user: User): Promise<SyncUserResponse> {
  const token = await user.getIdToken();
  const displayNameParts = (user.displayName || "").trim().split(/\s+/).filter(Boolean);

  const response = await request<SyncUserResponse>("/auth/sync-user", token, {
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    firstName: displayNameParts[0] || "",
    lastName: displayNameParts.slice(1).join(" "),
    username: user.email ? user.email.split("@")[0] : ""
  });

  return response.details || { uid: user.uid, isNewUser: false };
}

export async function getCurrentUser(user: User): Promise<UserProfile> {
  const token = await user.getIdToken();
  const response = await request<UserProfile>("/auth/me", token, undefined, "GET");

  if (!response.details) {
    throw new Error("User profile was not returned by the backend.");
  }

  return response.details;
}

export async function saveOnboarding(user: User, data: OnboardingPayload): Promise<void> {
  const token = await user.getIdToken();
  await request("/onboarding", token, data);
}

export async function getOnboarding(user: User): Promise<OnboardingPayload | null> {
  const token = await user.getIdToken();

  try {
    const response = await request<OnboardingPayload>("/onboarding", token, undefined, "GET");
    return response.details || null;
  } catch (error) {
    if (error instanceof Error && error.message === "Onboarding data not found.") {
      return null;
    }

    throw error;
  }
}
