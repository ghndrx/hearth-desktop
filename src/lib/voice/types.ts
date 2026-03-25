// WebRTC Voice Infrastructure Types

export interface Peer {
	userId: string;
	connection: RTCPeerConnection;
	audioTrack: MediaStreamTrack | null;
	remoteStream: MediaStream;
}

export interface IceServerConfig {
	urls: string | string[];
	username?: string;
	credential?: string;
}

export interface WebRTCConfig {
	iceServers: IceServerConfig[];
	iceTransportPolicy?: RTCIceTransportPolicy;
}

// Signaling message types

export interface SignalingOffer {
	type: 'offer';
	from_user_id: string;
	to_user_id: string;
	sdp: string;
}

export interface SignalingAnswer {
	type: 'answer';
	from_user_id: string;
	to_user_id: string;
	sdp: string;
}

export interface SignalingIceCandidate {
	type: 'ice-candidate';
	from_user_id: string;
	to_user_id: string;
	candidate: string;
	sdpMid: string | null;
	sdpMLineIndex: number | null;
}

export type SignalingMessage = SignalingOffer | SignalingAnswer | SignalingIceCandidate;

// Event maps for typed event emitters

export interface WebRTCEvents {
	'peer-connected': { userId: string };
	'peer-disconnected': { userId: string };
	'peer-track': { userId: string; track: MediaStreamTrack; stream: MediaStream };
	'peer-speaking': { userId: string; speaking: boolean };
	'local-stream-ready': { stream: MediaStream };
	'connection-state-changed': { userId: string; state: RTCPeerConnectionState };
	'error': { userId?: string; error: Error };
}

export interface SignalingEvents {
	'connected': void;
	'disconnected': { code: number; reason: string };
	'reconnecting': { attempt: number };
	'offer': SignalingOffer;
	'answer': SignalingAnswer;
	'ice-candidate': SignalingIceCandidate;
	'peer-list': { channelId: string; peers: string[] };
	'peer-joined': { userId: string; channelId: string };
	'peer-left': { userId: string; channelId: string };
	'error': Error;
}
