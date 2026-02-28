import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';

export interface BandwidthStats {
	bytes_sent: number;
	bytes_received: number;
	session_start: number;
	peak_download_rate: number;
	peak_upload_rate: number;
	current_download_rate: number;
	current_upload_rate: number;
}

const defaultStats: BandwidthStats = {
	bytes_sent: 0,
	bytes_received: 0,
	session_start: 0,
	peak_download_rate: 0,
	peak_upload_rate: 0,
	current_download_rate: 0,
	current_upload_rate: 0
};

export const bandwidthStats = writable<BandwidthStats>(defaultStats);
export const bandwidthMonitorActive = writable(false);

let pollInterval: ReturnType<typeof setInterval> | null = null;

export async function startBandwidthMonitor() {
	try {
		await invoke('bandwidth_start_monitor');
		bandwidthMonitorActive.set(true);

		pollInterval = setInterval(async () => {
			try {
				const stats = await invoke<BandwidthStats>('bandwidth_get_stats');
				bandwidthStats.set(stats);
			} catch {
				// ignore polling errors
			}
		}, 2000);
	} catch (e) {
		console.warn('Failed to start bandwidth monitor:', e);
	}
}

export async function stopBandwidthMonitor() {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
	try {
		await invoke('bandwidth_stop_monitor');
	} catch {
		// ignore
	}
	bandwidthMonitorActive.set(false);
}

export async function recordBytesSent(bytes: number) {
	try {
		await invoke('bandwidth_record_sent', { bytes });
	} catch {
		// ignore
	}
}

export async function recordBytesReceived(bytes: number) {
	try {
		await invoke('bandwidth_record_received', { bytes });
	} catch {
		// ignore
	}
}

export async function resetBandwidth() {
	try {
		await invoke('bandwidth_reset');
		bandwidthStats.set(defaultStats);
	} catch {
		// ignore
	}
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatRate(bytesPerSec: number): string {
	return `${formatBytes(bytesPerSec)}/s`;
}

export const totalTransferred = derived(bandwidthStats, ($s) => $s.bytes_sent + $s.bytes_received);
