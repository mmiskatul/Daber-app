import {
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
  registerGlobals
} from "react-native-webrtc";
import { VoiceRealtimeEvent, VoiceRtcSessionResponse } from "../api";
import { parseVoiceRealtimeEvent, serializeVoiceRealtimeEvent } from "./voiceEvents";

type EventHandler = (event: VoiceRealtimeEvent) => void;

type CreateOfferInput = {
  iceServers?: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
};

registerGlobals();

export class VoiceRtcClient {
  private readonly listeners = new Set<EventHandler>();

  private activeSession: VoiceRtcSessionResponse | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;

  private addPeerListener(
    peer: RTCPeerConnection,
    eventName: string,
    handler: (event?: unknown) => void
  ): () => void {
    const target = peer as unknown as {
      addEventListener: (name: string, listener: (event?: unknown) => void) => void;
      removeEventListener: (name: string, listener: (event?: unknown) => void) => void;
    };

    target.addEventListener(eventName, handler);
    return () => target.removeEventListener(eventName, handler);
  }

  private addDataChannelListener(
    channel: ReturnType<RTCPeerConnection["createDataChannel"]>,
    eventName: string,
    handler: (event?: unknown) => void
  ): () => void {
    const target = channel as unknown as {
      addEventListener: (name: string, listener: (event?: unknown) => void) => void;
      removeEventListener: (name: string, listener: (event?: unknown) => void) => void;
    };

    target.addEventListener(eventName, handler);
    return () => target.removeEventListener(eventName, handler);
  }

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

  async createOffer(input?: CreateOfferInput): Promise<string> {
    await this.ensurePeerConnection(input?.iceServers || []);
    const peer = this.peerConnection;

    if (!peer) {
      throw new Error("Peer connection was not created.");
    }

    const offer = await peer.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
      voiceActivityDetection: true
    });
    await peer.setLocalDescription(offer);
    await this.waitForIceGatheringComplete(peer);

    const localDescription = peer.localDescription;

    if (!localDescription?.sdp) {
      throw new Error("Local WebRTC offer was empty.");
    }

    return localDescription.sdp;
  }

  async applyAnswer(answerSdp: string): Promise<boolean> {
    const peer = this.peerConnection;

    if (!peer) {
      return false;
    }

    const trimmed = answerSdp.trim();

    // The backend still returns a scaffold answer until the media gateway is implemented.
    if (!trimmed || !trimmed.includes("m=")) {
      return false;
    }

    await peer.setRemoteDescription(
      new RTCSessionDescription({
        type: "answer",
        sdp: trimmed
      })
    );

    return true;
  }

  private async ensurePeerConnection(iceServers: CreateOfferInput["iceServers"]): Promise<void> {
    if (this.peerConnection) {
      return;
    }

    this.localStream = await mediaDevices.getUserMedia({
      audio: true,
      video: false
    });

    const peer = new RTCPeerConnection({
      iceServers: iceServers?.length
        ? iceServers
        : [{ urls: "stun:stun.l.google.com:19302" }]
    });

    this.localStream.getTracks().forEach((track) => {
      peer.addTrack(track, this.localStream as MediaStream);
    });

    this.addPeerListener(peer, "connectionstatechange", () => {
      const state = peer.connectionState;

      if (state === "connected") {
        this.emit({ type: "voice.session.state", state: "listening", voiceSessionId: this.activeSession?.voiceSessionId || "pending" });
      } else if (state === "connecting") {
        this.emit({ type: "voice.session.state", state: "connecting", voiceSessionId: this.activeSession?.voiceSessionId || "pending" });
      }
    });

    this.addPeerListener(peer, "datachannel", (event) => {
      const dataChannelEvent = event as { channel: ReturnType<RTCPeerConnection["createDataChannel"]> };
      this.addDataChannelListener(dataChannelEvent.channel, "message", (messageEvent) => {
        const payload = messageEvent as { data: unknown };
        if (typeof payload.data === "string") {
          this.receive(payload.data);
        }
      });
    });

    const channel = peer.createDataChannel("daber-voice-events");
    this.addDataChannelListener(channel, "message", (messageEvent) => {
      const payload = messageEvent as { data: unknown };
      if (typeof payload.data === "string") {
        this.receive(payload.data);
      }
    });

    this.peerConnection = peer;
  }

  private async waitForIceGatheringComplete(peer: RTCPeerConnection): Promise<void> {
    if (peer.iceGatheringState === "complete") {
      return;
    }

    await new Promise<void>((resolve) => {
      let removeListener: () => void = () => {};
      const timeout = setTimeout(() => {
        removeListener();
        resolve();
      }, 3000);

      const onChange = () => {
        if (peer.iceGatheringState === "complete") {
          clearTimeout(timeout);
          removeListener();
          resolve();
        }
      };

      removeListener = this.addPeerListener(peer, "icegatheringstatechange", onChange);
    });
  }

  async close(): Promise<void> {
    this.peerConnection?.close();
    this.peerConnection = null;
    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
    this.activeSession = null;
  }
}
