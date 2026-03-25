/** Represents a user in a voice room */
export interface VoiceUser {
	userId: string;
	username: string;
	displayName?: string;
	avatar?: string;
	isMuted: boolean;
	isDeafened: boolean;
	isSpeaking: boolean;
	joinedAt: number;
}

/** Voice room state */
export interface VoiceRoom {
	roomId: string;
	channelId: string;
	serverId: string;
	users: VoiceUser[];
	maxUsers?: number;
	bitrate?: number;
}

/** Tracked peer connection with associated metadata */
export interface PeerConnection {
	userId: string;
	connection: RTCPeerConnection;
	remoteStream: MediaStream;
	audioTrack: MediaStreamTrack | null;
	state: RTCPeerConnectionState;
	reconnectAttempts: number;
}

/** ICE server configuration */
export interface IceServer {
	urls: string | string[];
	username?: string;
	credential?: string;
}

/** Voice service configuration */
export interface VoiceServiceConfig {
	iceServers: IceServer[];
	signalingUrl: string;
	maxReconnectAttempts: number;
	reconnectDelayMs: number;
	audioBitrate: number;
}

/** Signaling message types */
export type SignalingMessageType =
	| 'offer'
	| 'answer'
	| 'ice-candidate'
	| 'join'
	| 'leave'
	| 'mute-update'
	| 'speaking';

/** Base signaling message */
export interface SignalingMessageBase {
	type: SignalingMessageType;
	fromUserId: string;
	toUserId?: string;
	channelId: string;
	timestamp: number;
}

export interface SdpMessage extends SignalingMessageBase {
	type: 'offer' | 'answer';
	sdp: string;
}

export interface IceCandidateMessage extends SignalingMessageBase {
	type: 'ice-candidate';
	candidate: string;
	sdpMid: string | null;
	sdpMLineIndex: number | null;
}

export interface JoinMessage extends SignalingMessageBase {
	type: 'join';
	username: string;
	displayName?: string;
}

export interface LeaveMessage extends SignalingMessageBase {
	type: 'leave';
}

export interface MuteUpdateMessage extends SignalingMessageBase {
	type: 'mute-update';
	isMuted: boolean;
	isDeafened: boolean;
}

export interface SpeakingMessage extends SignalingMessageBase {
	type: 'speaking';
	isSpeaking: boolean;
}

export type SignalingMessage =
	| SdpMessage
	| IceCandidateMessage
	| JoinMessage
	| LeaveMessage
	| MuteUpdateMessage
	| SpeakingMessage;

/** Signaling connection state */
export type SignalingConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** Media device info */
export interface AudioDevice {
	deviceId: string;
	label: string;
	kind: 'audioinput' | 'audiooutput';
	isDefault: boolean;
}

/** Events emitted by VoiceService */
export interface VoiceServiceEvents {
	'peer-joined': (user: VoiceUser) => void;
	'peer-left': (userId: string) => void;
	'peer-speaking': (userId: string, speaking: boolean) => void;
	'peer-mute-changed': (userId: string, muted: boolean, deafened: boolean) => void;
	'remote-stream': (userId: string, stream: MediaStream) => void;
	'local-stream-ready': (stream: MediaStream) => void;
	'connection-state-changed': (state: RTCPeerConnectionState, userId: string) => void;
	'signaling-state-changed': (state: SignalingConnectionState) => void;
	'error': (error: Error) => void;
}

/** Events emitted by SignalingService */
export interface SignalingServiceEvents {
	'connected': () => void;
	'disconnected': (reason?: string) => void;
	'message': (message: SignalingMessage) => void;
	'error': (error: Error) => void;
	'reconnecting': (attempt: number) => void;
}

/** Events emitted by MediaDeviceManager */
export interface MediaDeviceEvents {
	'devices-changed': (devices: AudioDevice[]) => void;
	'stream-acquired': (stream: MediaStream) => void;
	'stream-released': () => void;
	'error': (error: Error) => void;
}

/** Default configuration values */
export const DEFAULT_VOICE_CONFIG: VoiceServiceConfig = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
	],
	signalingUrl: '',
	maxReconnectAttempts: 5,
	reconnectDelayMs: 2000,
	audioBitrate: 64000,
};

export const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
	echoCancellation: true,
	noiseSuppression: true,
	autoGainControl: true,
	sampleRate: 48000,
};
