import { User } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

export type SupportLanguagePayload = {
  native: string;
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

export type RoadmapStop = {
  id: string;
  kind: "done" | "checkpoint" | "current" | "locked";
  title: string;
  he: string;
  fmt: string;
};

export type ScenarioThemeSummary = {
  id: string;
  title: string;
  he: string;
  heChar: string;
  band: string;
  blurb: string;
  locked: boolean;
};

export type ScenarioLaunchResponse = {
  sessionId: string;
  provider: "gemini" | "openai";
  providerConfigured: boolean;
  theme: {
    id: string;
    title: string;
    he: string;
    heChar: string;
    band: string;
    blurb: string;
  };
  ct: {
    id: string;
    title: string;
    turns: number;
  };
  variation: {
    id: string;
    label: string;
    situation: string;
  };
  tutorVoice: {
    id: string;
    name: string;
    subtitle: string;
  };
  learnerProfile: {
    native: string | null;
    level: string | null;
    goal: string | null;
  };
  conversation: {
    title: string;
    starterLine: string;
    promptSeed: string;
  };
};

export type ScenarioTurn = {
  role: "learner" | "tutor";
  text: string;
  translation?: string | null;
  createdAt: string;
  inputMode?: "voice" | "text";
  provider?: "gemini" | "openai";
  model?: string;
  liveModelCall?: boolean;
  pronunciation?: {
    overallScore: number;
    accuracyScore: number;
    fluencyScore: number;
    feedback: string;
    scoringMode: "audio" | "transcript";
    issues: Array<{
      label: string;
      issueCount: number;
      severity: "low" | "medium" | "high";
      affectedWord: string;
      expectedSound: string;
      heardApproximation: string;
      hint: string;
    }>;
  };
};

export type ScenarioSessionResponse = ScenarioLaunchResponse & {
  turns?: ScenarioTurn[];
  supportTranslations?: Record<string, Record<string, { sourceText?: string; translation?: string } | string>>;
  updatedAt?: unknown;
};

export type ScenarioMessageResponse = {
  sessionId: string;
  provider: "gemini" | "openai";
  providerConfigured: boolean;
  model: string;
  learnerTurn: ScenarioTurn;
  tutorTurn: ScenarioTurn;
};

export type ScenarioSpeechResponse = {
  audioBase64: string;
  mimeType: string;
  provider: "openai";
  model: string;
  voice: string;
  liveModelCall: boolean;
};

export type ScenarioVoiceResponse = {
  sessionId: string;
  provider: "gemini" | "openai";
  providerConfigured: boolean;
  model: string;
  transcript: string;
  pronunciation: {
    overallScore: number;
    accuracyScore: number;
    fluencyScore: number;
    feedback: string;
    scoringMode: "audio" | "transcript";
    issues: Array<{
      label: string;
      issueCount: number;
      severity: "low" | "medium" | "high";
      affectedWord: string;
      expectedSound: string;
      heardApproximation: string;
      hint: string;
    }>;
  };
  learnerTurn: ScenarioTurn;
  tutorTurn: ScenarioTurn;
};

export type ScenarioVoiceTranscriptResponse = {
  sessionId: string;
  transcript: string;
  learnerTurn: ScenarioTurn;
};

export type ScenarioTranslationResponse = {
  translation: string;
  provider: "gemini" | "openai";
  model: string;
  liveModelCall: boolean;
};

const ACCESS_TOKEN_KEY = "daber_access_token";
const REFRESH_TOKEN_KEY = "daber_refresh_token";

export async function getStoredAccessToken(): Promise<string | null> {
  return await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function request<T>(path: string, token: string, body?: unknown, method = "POST"): Promise<ApiSuccess<T>> {
  let response: Response;
  let activeToken = token;

  // 1. Read stored custom backend access token
  const storedAccess = await getStoredAccessToken();
  if (storedAccess && path !== "/auth/sync-user") {
    activeToken = storedAccess;
  }

  const makeCall = async (t: string) => {
    return await fetch(`${appConfig.backendBaseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
  };

  try {
    response = await makeCall(activeToken);
  } catch {
    throw new Error(`Network request failed. Backend URL: ${appConfig.backendBaseUrl}`);
  }

  let payload = (await response.json()) as ApiSuccess<T> | ApiError;

  // 2. Check for Token Expiration (401 ACCESS_TOKEN_EXPIRED)
  if (
    response.status === 401 &&
    payload.status === false &&
    payload.message === "Access token has expired." &&
    path !== "/auth/sync-user" &&
    path !== "/auth/refresh"
  ) {
    // Attempt transparent token refresh
    const storedRefresh = await getStoredRefreshToken();
    if (storedRefresh) {
      try {
        const refreshResponse = await fetch(`${appConfig.backendBaseUrl}/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ refreshToken: storedRefresh })
        });

        if (refreshResponse.ok) {
          const refreshPayload = await refreshResponse.json();
          if (refreshPayload.status === true && refreshPayload.details) {
            const { accessToken: newAccess, refreshToken: newRefresh } = refreshPayload.details;
            await storeTokens(newAccess, newRefresh);

            // Retry original request with the fresh Access Token
            response = await makeCall(newAccess);
            payload = (await response.json()) as ApiSuccess<T> | ApiError;
          }
        } else {
          // Refresh token expired or invalid; clear all stored tokens
          await clearTokens();
        }
      } catch {
        // Fall through to throw original 401 error
      }
    }
  }

  if (!response.ok || payload.status !== true) {
    throw new Error(payload.message || "Backend request failed.");
  }

  return payload;
}

export async function syncUser(user: User): Promise<SyncUserResponse> {
  const token = await user.getIdToken();
  const displayNameParts = (user.displayName || "").trim().split(/\s+/).filter(Boolean);

  const response = await request<{
    uid: string;
    isNewUser: boolean;
    accessToken: string;
    refreshToken: string;
  }>("/auth/sync-user", token, {
    firebaseToken: token,
    displayName: user.displayName || "",
    photoURL: user.photoURL || "",
    firstName: displayNameParts[0] || "",
    lastName: displayNameParts.slice(1).join(" "),
    username: user.email ? user.email.split("@")[0] : ""
  });

  if (response.details?.accessToken && response.details?.refreshToken) {
    await storeTokens(response.details.accessToken, response.details.refreshToken);
  }

  return {
    uid: response.details?.uid || user.uid,
    isNewUser: response.details?.isNewUser || false
  };
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

export async function updateSupportLanguage(user: User, data: SupportLanguagePayload): Promise<void> {
  const token = await user.getIdToken();
  await request("/onboarding/language", token, data, "PATCH");
}

export async function getScenarioThemes(user: User): Promise<{ todayThemeId: string; items: ScenarioThemeSummary[] }> {
  const token = await user.getIdToken();
  const response = await request<{ todayThemeId: string; items: ScenarioThemeSummary[] }>("/scenarios/themes", token, undefined, "GET");

  if (!response.details) {
    throw new Error("Scenario themes were not returned by the backend.");
  }

  return response.details;
}

export async function launchScenario(
  user: User,
  themeId: string,
  provider: "gemini" | "openai" = "openai",
  forceNew = false
): Promise<ScenarioLaunchResponse> {
  const token = await user.getIdToken();
  const response = await request<ScenarioLaunchResponse>("/scenarios/launch", token, { themeId, provider, forceNew });

  if (!response.details) {
    throw new Error("Scenario launch payload was not returned by the backend.");
  }

  return response.details;
}

export async function getScenarioSession(user: User, sessionId: string): Promise<ScenarioSessionResponse> {
  const token = await user.getIdToken();
  const response = await request<ScenarioSessionResponse>(`/scenarios/sessions/${sessionId}`, token, undefined, "GET");

  if (!response.details) {
    throw new Error("Scenario session was not returned by the backend.");
  }

  return response.details;
}

export async function sendScenarioMessage(
  user: User,
  sessionId: string,
  message: string
): Promise<ScenarioMessageResponse> {
  const token = await user.getIdToken();
  const response = await request<ScenarioMessageResponse>(`/scenarios/sessions/${sessionId}/message`, token, { message });

  if (!response.details) {
    throw new Error("Scenario message response was not returned by the backend.");
  }

  return response.details;
}

export async function translateScenarioTurn(
  user: User,
  sessionId: string,
  text: string,
  native: string
): Promise<ScenarioTranslationResponse> {
  const token = await user.getIdToken();
  const response = await request<ScenarioTranslationResponse>(`/scenarios/sessions/${sessionId}/translate`, token, { text, native });

  if (!response.details) {
    throw new Error("Scenario translation response was not returned by the backend.");
  }

  return response.details;
}

export async function synthesizeScenarioTutorSpeech(
  user: User,
  sessionId: string,
  text: string
): Promise<ScenarioSpeechResponse> {
  const token = await user.getIdToken();
  const response = await request<ScenarioSpeechResponse>(`/scenarios/sessions/${sessionId}/speech`, token, { text });

  if (!response.details) {
    throw new Error("Scenario speech response was not returned by the backend.");
  }

  return response.details;
}

export async function sendScenarioVoice(
  user: User,
  sessionId: string,
  input: {
    audioBase64: string;
    mimeType?: string;
    fileName?: string;
    referenceText?: string;
  }
): Promise<ScenarioVoiceResponse> {
  const token = await user.getIdToken();
  const response = await request<ScenarioVoiceResponse>(`/scenarios/sessions/${sessionId}/voice`, token, input);

  if (!response.details) {
    throw new Error("Scenario voice response was not returned by the backend.");
  }

  return response.details;
}

export async function transcribeScenarioVoice(
  user: User,
  sessionId: string,
  input: {
    audioBase64: string;
    mimeType?: string;
    fileName?: string;
    referenceText?: string;
  }
): Promise<ScenarioVoiceTranscriptResponse> {
  const token = await user.getIdToken();
  const response = await request<ScenarioVoiceTranscriptResponse>(`/scenarios/sessions/${sessionId}/voice/transcribe`, token, input);

  if (!response.details) {
    throw new Error("Scenario voice transcript response was not returned by the backend.");
  }

  return response.details;
}

export async function respondScenarioVoice(
  user: User,
  sessionId: string,
  input: {
    transcript: string;
    referenceText?: string;
  }
): Promise<ScenarioVoiceResponse> {
  const token = await user.getIdToken();
  const response = await request<ScenarioVoiceResponse>(`/scenarios/sessions/${sessionId}/voice/respond`, token, input);

  if (!response.details) {
    throw new Error("Scenario voice response was not returned by the backend.");
  }

  return response.details;
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

export async function getRoadmap(user: User): Promise<RoadmapStop[]> {
  const token = await user.getIdToken();
  const response = await request<{ stops: RoadmapStop[] }>("/scenarios/roadmap", token, undefined, "GET");

  if (!response.details?.stops) {
    throw new Error("Roadmap stops were not returned by the backend.");
  }

  return response.details.stops;
}

export async function completeRoadmapStop(user: User, stopId: string): Promise<void> {
  const token = await user.getIdToken();
  await request("/scenarios/roadmap/complete", token, { stopId });
}
