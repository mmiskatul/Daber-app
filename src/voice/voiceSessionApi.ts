import { User } from "firebase/auth";
import { closeVoiceRtcSession, createVoiceRtcSession, reconnectVoiceRtcSession, VoiceRtcSessionResponse } from "../api";

export async function createRtcVoiceSession(
  user: User,
  input: {
    scenarioSessionId: string;
    offerSdp: string;
    referenceText?: string;
  }
): Promise<VoiceRtcSessionResponse> {
  return await createVoiceRtcSession(user, input);
}

export async function reconnectRtcVoiceSession(
  user: User,
  input: {
    voiceSessionId: string;
    offerSdp: string;
  }
): Promise<VoiceRtcSessionResponse> {
  return await reconnectVoiceRtcSession(user, input);
}

export async function closeRtcVoiceSession(user: User, voiceSessionId: string): Promise<void> {
  await closeVoiceRtcSession(user, voiceSessionId);
}
