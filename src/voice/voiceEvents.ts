import { VoiceRealtimeEvent } from "../api";

export function parseVoiceRealtimeEvent(input: string): VoiceRealtimeEvent {
  return JSON.parse(input) as VoiceRealtimeEvent;
}

export function serializeVoiceRealtimeEvent(event: VoiceRealtimeEvent): string {
  return JSON.stringify(event);
}
