import type {
	AudioDevice,
	MediaDeviceEvents,
} from './types';
import { DEFAULT_AUDIO_CONSTRAINTS } from './types';

type EventCallback<T extends keyof MediaDeviceEvents> = MediaDeviceEvents[T];

/**
 * Manages audio input/output device enumeration, selection, and
 * media stream lifecycle. Listens for device changes and provides
 * methods to switch devices without tearing down peer connections.
 */
export class MediaDeviceManager {
	private localStream: MediaStream | null = null;
	private selectedInputDeviceId: string | null = null;
	private selectedOutputDeviceId: string | null = null;
	private devices: AudioDevice[] = [];
	private listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	private deviceChangeHandler: (() => void) | null = null;

	constructor() {
		if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
			this.deviceChangeHandler = () => this.refreshDevices();
			navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeHandler);
		}
	}

	getLocalStream(): MediaStream | null {
		return this.localStream;
	}

	getDevices(): AudioDevice[] {
		return this.devices;
	}

	getInputDevices(): AudioDevice[] {
		return this.devices.filter(d => d.kind === 'audioinput');
	}

	getOutputDevices(): AudioDevice[] {
		return this.devices.filter(d => d.kind === 'audiooutput');
	}

	/**
	 * Enumerate all audio devices. Requires microphone permission
	 * to get meaningful labels.
	 */
	async refreshDevices(): Promise<AudioDevice[]> {
		if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
			return [];
		}

		const rawDevices = await navigator.mediaDevices.enumerateDevices();

		this.devices = rawDevices
			.filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput')
			.map(d => ({
				deviceId: d.deviceId,
				label: d.label || `${d.kind === 'audioinput' ? 'Microphone' : 'Speaker'} (${d.deviceId.slice(0, 8)})`,
				kind: d.kind as 'audioinput' | 'audiooutput',
				isDefault: d.deviceId === 'default',
			}));

		this.emit('devices-changed', this.devices);
		return this.devices;
	}

	/**
	 * Acquire the local audio stream (microphone).
	 */
	async acquireStream(constraints?: MediaTrackConstraints): Promise<MediaStream> {
		if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
			throw new Error('MediaDevices API not available');
		}

		// Release existing stream before acquiring a new one
		if (this.localStream) {
			this.releaseStream();
		}

		const audioConstraints: MediaTrackConstraints = {
			...DEFAULT_AUDIO_CONSTRAINTS,
			...constraints,
		};

		if (this.selectedInputDeviceId) {
			audioConstraints.deviceId = { exact: this.selectedInputDeviceId };
		}

		this.localStream = await navigator.mediaDevices.getUserMedia({
			audio: audioConstraints,
			video: false,
		});

		// Refresh device list now that we have permission
		await this.refreshDevices();

		this.emit('stream-acquired', this.localStream);
		return this.localStream;
	}

	/**
	 * Release the local stream and stop all tracks.
	 */
	releaseStream(): void {
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => track.stop());
			this.localStream = null;
			this.emit('stream-released');
		}
	}

	/**
	 * Switch the input device. Acquires a new stream with the selected device
	 * and returns it so callers can replace tracks on peer connections.
	 */
	async switchInputDevice(deviceId: string): Promise<MediaStream> {
		this.selectedInputDeviceId = deviceId;
		return this.acquireStream();
	}

	/**
	 * Set the output device on an audio element.
	 * Only works in browsers that support setSinkId.
	 */
	async setOutputDevice(audioElement: HTMLAudioElement, deviceId: string): Promise<void> {
		this.selectedOutputDeviceId = deviceId;

		if ('setSinkId' in audioElement) {
			await (audioElement as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(deviceId);
		}
	}

	getSelectedInputDeviceId(): string | null {
		return this.selectedInputDeviceId;
	}

	getSelectedOutputDeviceId(): string | null {
		return this.selectedOutputDeviceId;
	}

	/**
	 * Set mute state on the local stream tracks.
	 */
	setMuted(muted: boolean): void {
		this.localStream?.getAudioTracks().forEach(track => {
			track.enabled = !muted;
		});
	}

	on<T extends keyof MediaDeviceEvents>(event: T, callback: EventCallback<T>): () => void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		const cb = callback as (...args: unknown[]) => void;
		this.listeners.get(event)!.add(cb);
		return () => {
			this.listeners.get(event)?.delete(cb);
		};
	}

	private emit(event: string, ...args: unknown[]): void {
		this.listeners.get(event)?.forEach(cb => cb(...args));
	}

	destroy(): void {
		this.releaseStream();

		if (this.deviceChangeHandler && typeof navigator !== 'undefined' && navigator.mediaDevices) {
			navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeHandler);
			this.deviceChangeHandler = null;
		}

		this.listeners.clear();
	}
}
