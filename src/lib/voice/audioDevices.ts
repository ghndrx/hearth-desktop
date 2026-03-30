// Cross-platform audio device enumeration via Tauri
import { invoke } from '@tauri-apps/api/core';
import type { AudioDevice } from './types.js';

/**
 * Enumerate all available audio input and output devices
 * Uses cross-platform audio device enumeration via cpal (WASAPI/Core Audio/PipeWire)
 *
 * @returns Promise<AudioDevice[]> Array of available audio devices
 */
export async function enumerateAudioDevices(): Promise<AudioDevice[]> {
	try {
		const devices = await invoke<AudioDevice[]>('enumerate_audio_devices');
		return devices;
	} catch (error) {
		console.error('Failed to enumerate audio devices:', error);
		throw new Error(`Audio device enumeration failed: ${error}`);
	}
}

/**
 * Get all audio input devices
 *
 * @returns Promise<AudioDevice[]> Array of input devices only
 */
export async function getAudioInputDevices(): Promise<AudioDevice[]> {
	const devices = await enumerateAudioDevices();
	return devices.filter(device => device.deviceType === 'input');
}

/**
 * Get all audio output devices
 *
 * @returns Promise<AudioDevice[]> Array of output devices only
 */
export async function getAudioOutputDevices(): Promise<AudioDevice[]> {
	const devices = await enumerateAudioDevices();
	return devices.filter(device => device.deviceType === 'output');
}

/**
 * Get the default audio input device
 *
 * @returns Promise<AudioDevice | null> Default input device or null if none
 */
export async function getDefaultInputDevice(): Promise<AudioDevice | null> {
	const inputDevices = await getAudioInputDevices();
	return inputDevices.find(device => device.isDefault) || null;
}

/**
 * Get the default audio output device
 *
 * @returns Promise<AudioDevice | null> Default output device or null if none
 */
export async function getDefaultOutputDevice(): Promise<AudioDevice | null> {
	const outputDevices = await getAudioOutputDevices();
	return outputDevices.find(device => device.isDefault) || null;
}