import React from "react";
import { User } from "firebase/auth";
import { VoiceRealtimeEvent, VoiceRtcSessionResponse, VoiceRtcState } from "../api";
import { VoiceRtcClient } from "./VoiceRtcClient";
import { closeRtcVoiceSession, createRtcVoiceSession, reconnectRtcVoiceSession } from "./voiceSessionApi";

type UseVoiceRtcSessionArgs = {
  user: User;
  scenarioSessionId: string;
};

type UseVoiceRtcSessionResult = {
  state: VoiceRtcState;
  session: VoiceRtcSessionResponse | null;
  lastEvent: VoiceRealtimeEvent | null;
  error: string | null;
  connect: (input: { referenceText?: string }) => Promise<VoiceRtcSessionResponse>;
  reconnect: (offerSdp: string) => Promise<VoiceRtcSessionResponse>;
  disconnect: () => Promise<void>;
  client: VoiceRtcClient;
};

export function useVoiceRtcSession(args: UseVoiceRtcSessionArgs): UseVoiceRtcSessionResult {
  const clientRef = React.useRef<VoiceRtcClient | null>(null);
  const [state, setState] = React.useState<VoiceRtcState>("idle");
  const [session, setSession] = React.useState<VoiceRtcSessionResponse | null>(null);
  const [lastEvent, setLastEvent] = React.useState<VoiceRealtimeEvent | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!clientRef.current) {
    clientRef.current = new VoiceRtcClient();
  }

  React.useEffect(() => {
    return clientRef.current?.onEvent((event) => {
      setLastEvent(event);
    });
  }, []);

  const connect = React.useCallback(
    async (input: { referenceText?: string }) => {
      setState("connecting");
      setError(null);

      try {
        const offerSdp = await clientRef.current!.createOffer();
        const nextSession = await createRtcVoiceSession(args.user, {
          scenarioSessionId: args.scenarioSessionId,
          offerSdp,
          referenceText: input.referenceText
        });
        await clientRef.current?.applyAnswer(nextSession.answerSdp);
        clientRef.current?.setSession(nextSession);
        setSession(nextSession);
        setState("connected");
        return nextSession;
      } catch (connectError) {
        setState("failed");
        setError(connectError instanceof Error ? connectError.message : "Failed to create RTC voice session.");
        throw connectError;
      }
    },
    [args.scenarioSessionId, args.user]
  );

  const reconnect = React.useCallback(
    async (offerSdp: string) => {
      const currentSession = clientRef.current?.session;

      if (!currentSession) {
        throw new Error("No active RTC voice session is available to reconnect.");
      }

      setState("reconnecting");
      setError(null);

      try {
        const nextOfferSdp = offerSdp || (await clientRef.current!.createOffer(currentSession.iceServers ? { iceServers: currentSession.iceServers } : undefined));
        const nextSession = await reconnectRtcVoiceSession(args.user, {
          voiceSessionId: currentSession.voiceSessionId,
          offerSdp: nextOfferSdp
        });
        await clientRef.current?.applyAnswer(nextSession.answerSdp);
        clientRef.current?.setSession(nextSession);
        setSession(nextSession);
        setState("connected");
        return nextSession;
      } catch (reconnectError) {
        setState("failed");
        setError(reconnectError instanceof Error ? reconnectError.message : "Failed to reconnect RTC voice session.");
        throw reconnectError;
      }
    },
    [args.user]
  );

  const disconnect = React.useCallback(async () => {
    const currentSession = clientRef.current?.session;

    if (currentSession) {
      await closeRtcVoiceSession(args.user, currentSession.voiceSessionId);
    }

    await clientRef.current?.close();
    setSession(null);
    setState("idle");
  }, [args.user]);

  return {
    state,
    session,
    lastEvent,
    error,
    connect,
    reconnect,
    disconnect,
    client: clientRef.current
  };
}
