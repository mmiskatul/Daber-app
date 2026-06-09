import { VoiceRealtimeEvent, VoiceRtcSessionResponse } from "../api";
import { parseVoiceRealtimeEvent, serializeVoiceRealtimeEvent } from "./voiceEvents";

type EventHandler = (event: VoiceRealtimeEvent) => void;

export class VoiceRtcClient {
  private readonly listeners = new Set<EventHandler>();

  private activeSession: VoiceRtcSessionResponse | null = null;

  get session(): VoiceRtcSessionResponse | null {
    return this.activeSession;
  }

  setSession(session: VoiceRtcSessionResponse | null): void {
    this.activeSession = session;
  }

  onEvent(handler: EventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  emit(event: VoiceRealtimeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  receive(rawEvent: string): void {
    this.emit(parseVoiceRealtimeEvent(rawEvent));
  }

  send(event: VoiceRealtimeEvent): string {
    return serializeVoiceRealtimeEvent(event);
  }

  async close(): Promise<void> {
    this.activeSession = null;
  }
}
