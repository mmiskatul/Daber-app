import React from "react";

export type VoiceActivityState = {
  speaking: boolean;
  lastSpeechStartedAt: string | null;
  lastSpeechStoppedAt: string | null;
};

export function useVoiceActivity() {
  const [state, setState] = React.useState<VoiceActivityState>({
    speaking: false,
    lastSpeechStartedAt: null,
    lastSpeechStoppedAt: null
  });

  const markSpeechStarted = React.useCallback(() => {
    setState({
      speaking: true,
      lastSpeechStartedAt: new Date().toISOString(),
      lastSpeechStoppedAt: null
    });
  }, []);

  const markSpeechStopped = React.useCallback(() => {
    setState((current) => ({
      speaking: false,
      lastSpeechStartedAt: current.lastSpeechStartedAt,
      lastSpeechStoppedAt: new Date().toISOString()
    }));
  }, []);

  return {
    state,
    markSpeechStarted,
    markSpeechStopped
  };
}
