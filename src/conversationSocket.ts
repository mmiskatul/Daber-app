import { io, type Socket } from "socket.io-client";
import { appConfig } from "./config";
import type { ScenarioTurn } from "./api";

type Ack = { ok: boolean; error?: string };

type ServerEvents = {
  "scenario:learner_turn": (payload: { requestId: string; learnerTurn: ScenarioTurn }) => void;
  "scenario:learner_turn_update": (payload: { requestId: string; learnerTurn: ScenarioTurn }) => void;
  "scenario:tutor_pending": (payload: { requestId: string; tutorName: string }) => void;
  "scenario:tutor_turn": (payload: { requestId: string; tutorTurn: ScenarioTurn }) => void;
  "scenario:error": (payload: { requestId: string; message: string }) => void;
};

type ClientEvents = {
  "scenario:join": (payload: { sessionId: string }, ack?: (response: Ack) => void) => void;
  "scenario:text_turn": (payload: { sessionId: string; requestId: string; message: string }, ack?: (response: Ack) => void) => void;
  "scenario:voice_turn": (
    payload: {
      sessionId: string;
      requestId: string;
      audioBase64: string;
      mimeType?: string;
      fileName?: string;
      referenceText?: string;
    },
    ack?: (response: Ack) => void
  ) => void;
};

export type ConversationSocket = Socket<ServerEvents, ClientEvents>;

export function createConversationSocket(accessToken: string): ConversationSocket {
  return io(appConfig.backendBaseUrl, {
    transports: ["websocket", "polling"],
    auth: {
      token: accessToken
    }
  });
}
