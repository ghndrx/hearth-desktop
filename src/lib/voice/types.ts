/** ICE server configuration for STUN/TURN */
export interface IceServerConfig {
	urls: string | string[];
	username?: string;
	credential?: string;
}

/** Represents a remote peer in a voice channel */
export interface Peer {
	userId: string;
	connection: RTCPeerConnection;
	remoteStream: MediaStream;
	audioTrack: MediaStreamTrack | null;
	connectionState: RTCPeerConnectionState;
}

/** WebRTC signaling message types */
export type SignalingMessageType = 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';

/** Base signaling message */
export interface SignalingMessage {
	type: SignalingMessageType;
	fromUserId: string;
	toUserId?: string;
	channelId: string;
}

export interface SignalingOffer extends SignalingMessage {
	type: 'offer';
	sdp: string;
}

export interface SignalingAnswer extends SignalingMessage {
	type: 'answer';
	sdp: string;
}

export interface SignalingIceCandidate extends SignalingMessage {
	type: 'ice-candidate';
	candidate: string;
	sdpMid: string | null;
	sdpMLineIndex: number | null;
}

export interface SignalingJoin extends SignalingMessage {
	type: 'join';
}

export interface SignalingLeave extends SignalingMessage {
	type: 'leave';
}

export type AnySignalingMessage =
	| SignalingOffer
	| SignalingAnswer
	| SignalingIceCandidate
	| SignalingJoin
	| SignalingLeave;

/** WebRTC connection configuration */
export interface WebRTCConfig {
	iceServers: IceServerConfig[];
	/** Max reconnection attempts before giving up */
	maxReconnectAttempts: number;
	/** Delay in ms between reconnection attempts */
	reconnectDelay: number;
}

/** Default WebRTC configuration */
export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
		{ urls: 'stun:stun2.l.google.com:19302' },
	],
	maxReconnectAttempts: 5,
	reconnectDelay: 2000,
};

/** Audio constraints for getUserMedia */
export const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
	echoCancellation: true,
	noiseSuppression: true,
	autoGainControl: true,
};

/** Events emitted by WebRTCConnectionManager */
export interface WebRTCEvents {
	'peer-connected': (userId: string) => void;
	'peer-disconnected': (userId: string) => void;
	'remote-stream': (userId: string, stream: MediaStream) => void;
	'connection-state-changed': (state: RTCPeerConnectionState, userId: string) => void;
	'local-stream-ready': (stream: MediaStream) => void;
	'error': (error: Error) => void;
}

/** Events emitted by SignalingClient */
export interface SignalingEvents {
	'connected': () => void;
	'disconnected': (reason?: string) => void;
	'message': (message: AnySignalingMessage) => void;
	'error': (error: Error) => void;
	'reconnecting': (attempt: number) => void;
}

/** Signaling connection state */
export type SignalingState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
