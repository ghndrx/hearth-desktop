import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaDeviceManager } from '../MediaDeviceManager';

// Mock Web APIs
const mockMediaDevices = {
	getUserMedia: vi.fn(),
	enumerateDevices: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn()
};

global.navigator = {
	...global.navigator,
	mediaDevices: mockMediaDevices
};

global.MediaStream = vi.fn().mockImplementation(() => ({
	getTracks: vi.fn().mockReturnValue([
		{ stop: vi.fn(), enabled: true, kind: 'audio' }
	]),
	getAudioTracks: vi.fn().mockReturnValue([
		{ stop: vi.fn(), enabled: true, kind: 'audio' }
	])
}));

describe('MediaDeviceManager', () => {
	let mediaManager: MediaDeviceManager;

	beforeEach(() => {
		vi.clearAllMocks();
		mediaManager = new MediaDeviceManager();
	});

	afterEach(() => {
		mediaManager.destroy();
	});

	describe('initialization', () => {
		it('should register device change listener', () => {
			expect(mockMediaDevices.addEventListener).toHaveBeenCalledWith(
				'devicechange',
				expect.any(Function)
			);
		});
	});

	describe('device enumeration', () => {
		it('should enumerate available devices', async () => {
			const mockDevices = [
				{
					deviceId: 'input1',
					label: 'Microphone',
					kind: 'audioinput'
				},
				{
					deviceId: 'output1',
					label: 'Speaker',
					kind: 'audiooutput'
				},
				{
					deviceId: 'camera1',
					label: 'Camera',
					kind: 'videoinput'
				}
			];

			mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices);

			const devices = await mediaManager.refreshDevices();

			expect(devices).toEqual([
				{
					deviceId: 'input1',
					label: 'Microphone',
					kind: 'audioinput',
					isDefault: false
				},
				{
					deviceId: 'output1',
					label: 'Speaker',
					kind: 'audiooutput',
					isDefault: false
				}
			]);

			// Should filter out video devices
			expect(devices.length).toBe(2);
		});

		it('should provide fallback labels for devices without permission', async () => {
			const mockDevices = [
				{
					deviceId: 'abcd1234',
					label: '', // No permission
					kind: 'audioinput'
				}
			];

			mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices);

			const devices = await mediaManager.refreshDevices();

			expect(devices[0].label).toBe('Microphone (abcd1234)');
		});

		it('should handle default devices', async () => {
			const mockDevices = [
				{
					deviceId: 'default',
					label: 'Default Microphone',
					kind: 'audioinput'
				}
			];

			mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices);

			const devices = await mediaManager.refreshDevices();

			expect(devices[0].isDefault).toBe(true);
		});

		it('should return empty array when mediaDevices not available', async () => {
			// Mock navigator.mediaDevices as undefined
			const originalMediaDevices = global.navigator.mediaDevices;
			(global.navigator as any).mediaDevices = undefined;

			const devices = await mediaManager.refreshDevices();

			expect(devices).toEqual([]);

			// Restore
			(global.navigator as any).mediaDevices = originalMediaDevices;
		});
	});

	describe('device filtering', () => {
		beforeEach(async () => {
			const mockDevices = [
				{
					deviceId: 'input1',
					label: 'Microphone 1',
					kind: 'audioinput'
				},
				{
					deviceId: 'input2',
					label: 'Microphone 2',
					kind: 'audioinput'
				},
				{
					deviceId: 'output1',
					label: 'Speaker 1',
					kind: 'audiooutput'
				},
				{
					deviceId: 'output2',
					label: 'Speaker 2',
					kind: 'audiooutput'
				}
			];

			mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices);
			await mediaManager.refreshDevices();
		});

		it('should filter input devices', () => {
			const inputDevices = mediaManager.getInputDevices();

			expect(inputDevices).toHaveLength(2);
			expect(inputDevices.every(d => d.kind === 'audioinput')).toBe(true);
		});

		it('should filter output devices', () => {
			const outputDevices = mediaManager.getOutputDevices();

			expect(outputDevices).toHaveLength(2);
			expect(outputDevices.every(d => d.kind === 'audiooutput')).toBe(true);
		});
	});

	describe('stream management', () => {
		it('should acquire audio stream', async () => {
			const mockStream = new MediaStream();
			mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

			const stream = await mediaManager.acquireStream();

			expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
				audio: expect.objectContaining({
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
					sampleRate: 48000
				}),
				video: false
			});

			expect(stream).toBe(mockStream);
			expect(mediaManager.getLocalStream()).toBe(mockStream);
		});

		it('should use custom constraints', async () => {
			const mockStream = new MediaStream();
			mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

			const customConstraints = {
				sampleRate: 44100,
				echoCancellation: false
			};

			await mediaManager.acquireStream(customConstraints);

			expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
				audio: expect.objectContaining({
					echoCancellation: false, // Custom value
					noiseSuppression: true, // Default value
					sampleRate: 44100 // Custom value
				}),
				video: false
			});
		});

		it('should use selected input device', async () => {
			const mockStream = new MediaStream();
			mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

			// Set selected device first
			await mediaManager.switchInputDevice('specific-device-id');

			expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
				audio: expect.objectContaining({
					deviceId: { exact: 'specific-device-id' }
				}),
				video: false
			});
		});

		it('should release existing stream before acquiring new one', async () => {
			const mockStream1 = new MediaStream();
			const mockStream2 = new MediaStream();

			mockMediaDevices.getUserMedia
				.mockResolvedValueOnce(mockStream1)
				.mockResolvedValueOnce(mockStream2);

			// Acquire first stream
			await mediaManager.acquireStream();

			// Acquire second stream
			await mediaManager.acquireStream();

			// Should stop tracks from first stream
			expect(mockStream1.getTracks()[0].stop).toHaveBeenCalled();
			expect(mediaManager.getLocalStream()).toBe(mockStream2);
		});

		it('should release stream and stop tracks', () => {
			const mockTrack = { stop: vi.fn(), enabled: true, kind: 'audio' };
			const mockStream = { getTracks: vi.fn().mockReturnValue([mockTrack]) };

			// Manually set stream
			(mediaManager as any).localStream = mockStream;

			mediaManager.releaseStream();

			expect(mockTrack.stop).toHaveBeenCalled();
			expect(mediaManager.getLocalStream()).toBeNull();
		});

		it('should emit events for stream lifecycle', async () => {
			const mockStream = new MediaStream();
			mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

			const acquiredCallback = vi.fn();
			const releasedCallback = vi.fn();

			mediaManager.on('stream-acquired', acquiredCallback);
			mediaManager.on('stream-released', releasedCallback);

			await mediaManager.acquireStream();
			expect(acquiredCallback).toHaveBeenCalledWith(mockStream);

			mediaManager.releaseStream();
			expect(releasedCallback).toHaveBeenCalled();
		});
	});

	describe('device switching', () => {
		it('should switch input device and return new stream', async () => {
			const mockStream = new MediaStream();
			mockMediaDevices.getUserMedia.mockResolvedValue(mockStream);

			const newStream = await mediaManager.switchInputDevice('new-device-id');

			expect(mediaManager.getSelectedInputDeviceId()).toBe('new-device-id');
			expect(newStream).toBe(mockStream);
		});

		it('should set output device on audio element', async () => {
			const mockAudioElement = {
				setSinkId: vi.fn()
			} as any;

			await mediaManager.setOutputDevice(mockAudioElement, 'output-device-id');

			expect(mockAudioElement.setSinkId).toHaveBeenCalledWith('output-device-id');
			expect(mediaManager.getSelectedOutputDeviceId()).toBe('output-device-id');
		});

		it('should handle audio elements without setSinkId', async () => {
			const mockAudioElement = {} as HTMLAudioElement;

			// Should not throw
			await expect(
				mediaManager.setOutputDevice(mockAudioElement, 'output-device-id')
			).resolves.toBeUndefined();

			expect(mediaManager.getSelectedOutputDeviceId()).toBe('output-device-id');
		});
	});

	describe('mute control', () => {
		it('should mute/unmute audio tracks', async () => {
			const mockTrack = { enabled: true, kind: 'audio' };
			const mockStream = {
				getAudioTracks: vi.fn().mockReturnValue([mockTrack])
			};

			// Manually set stream
			(mediaManager as any).localStream = mockStream;

			mediaManager.setMuted(true);
			expect(mockTrack.enabled).toBe(false);

			mediaManager.setMuted(false);
			expect(mockTrack.enabled).toBe(true);
		});

		it('should handle no local stream gracefully', () => {
			// Should not throw
			expect(() => mediaManager.setMuted(true)).not.toThrow();
		});
	});

	describe('cleanup', () => {
		it('should remove event listeners and release stream on destroy', () => {
			const mockTrack = { stop: vi.fn(), enabled: true, kind: 'audio' };
			const mockStream = { getTracks: vi.fn().mockReturnValue([mockTrack]) };

			// Set stream
			(mediaManager as any).localStream = mockStream;

			mediaManager.destroy();

			expect(mockMediaDevices.removeEventListener).toHaveBeenCalledWith(
				'devicechange',
				expect.any(Function)
			);

			expect(mockTrack.stop).toHaveBeenCalled();
		});

		it('should handle destroy when mediaDevices not available', () => {
			const originalMediaDevices = global.navigator.mediaDevices;
			(global.navigator as any).mediaDevices = undefined;

			// Should not throw
			expect(() => mediaManager.destroy()).not.toThrow();

			// Restore
			(global.navigator as any).mediaDevices = originalMediaDevices;
		});
	});

	describe('error handling', () => {
		it('should handle getUserMedia errors', async () => {
			const error = new Error('Permission denied');
			mockMediaDevices.getUserMedia.mockRejectedValue(error);

			await expect(mediaManager.acquireStream()).rejects.toThrow('Permission denied');
		});

		it('should handle enumerateDevices errors', async () => {
			const error = new Error('Device enumeration failed');
			mockMediaDevices.enumerateDevices.mockRejectedValue(error);

			await expect(mediaManager.refreshDevices()).rejects.toThrow('Device enumeration failed');
		});

		it('should handle missing mediaDevices API', async () => {
			const originalMediaDevices = global.navigator.mediaDevices;
			(global.navigator as any).mediaDevices = undefined;

			await expect(mediaManager.acquireStream()).rejects.toThrow('MediaDevices API not available');

			// Restore
			(global.navigator as any).mediaDevices = originalMediaDevices;
		});
	});
});