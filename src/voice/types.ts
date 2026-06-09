import type { ScenarioTurn, VoiceRealtimeEvent, VoiceRtcSessionResponse, VoiceRtcState } from "../api";

export type VoiceClientTransport = "upload" | "webrtc";

export type VoiceSessionController = {
  connect: (input: { offerSdp: string; referenceText?: string }) => Promise<VoiceRtcSessionResponse>;
  reconnect: (offerSdp: string) => Promise<VoiceRtcSessionResponse>;
  disconnect: () => Promise<void>;
  sendEvent: (event: VoiceRealtimeEvent) => void;
};

export type VoiceSessionSnapshot = {
  state: VoiceRtcState;
  connected: boolean;
  voiceSessionId: string | null;
  gatewayUrl: string | null;
  lastEvent: VoiceRealtimeEvent | null;
  lastError: string | null;
};

export type VoiceTurnPatch =
  | { type: "replaceLearnerText"; utteranceId: string; text: string }
  | { type: "setTutorPending"; utteranceId: string; tutorName: string }
  | { type: "setTutorTurn"; utteranceId: string; tutorTurn: ScenarioTurn }
  | {
      type: "setPronunciation";
      utteranceId: string;
      learnerTurnLocalId: string;
      pronunciation: NonNullable<ScenarioTurn["pronunciation"]>;
    };
