import { appConfig } from "../config";

export function isVoiceRtcEnabled(): boolean {
  return appConfig.voiceRtcEnabled;
}
