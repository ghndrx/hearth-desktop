import { writable, derived } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface SpeedTestResult {
	id: string;
	downloadMbps: number;
	uploadMbps: number;
	latencyMs: number;
	jitterMs: number;
	quality: string;
	server: string;
	timestamp: string;
}

export interface SpeedTestState {
	history: SpeedTestResult[];
	isRunning: boolean;
	lastResult: SpeedTestResult | null;
	averageDownload: number;
	averageUpload: number;
	averageLatency: number;
}

export const speedTestState = writable<SpeedTestState>({
	history: [],
	isRunning: false,
	lastResult: null,
	averageDownload: 0,
	averageUpload: 0,
	averageLatency: 0
});

export const currentPhase = writable<string>('');
export const isTestRunning = derived(speedTestState, ($s) => $s.isRunning);
export const lastResult = derived(speedTestState, ($s) => $s.lastResult);
export const testHistory = derived(speedTestState, ($s) => $s.history);

export async function runSpeedTest(): Promise<SpeedTestResult> {
	speedTestState.update((s) => ({ ...s, isRunning: true }));
	try {
		const result = await invoke<SpeedTestResult>('speedtest_run');
		await loadSpeedTestState();
		return result;
	} finally {
		speedTestState.update((s) => ({ ...s, isRunning: false }));
	}
}

export async function quickLatencyTest(server?: string): Promise<number> {
	return invoke<number>('speedtest_quick_latency', { server });
}

export async function loadSpeedTestState(): Promise<void> {
	const state = await invoke<SpeedTestState>('speedtest_get_state');
	speedTestState.set(state);
}

export async function getSpeedTestHistory(): Promise<SpeedTestResult[]> {
	return invoke<SpeedTestResult[]>('speedtest_get_history');
}

export async function clearSpeedTestHistory(): Promise<void> {
	await invoke('speedtest_clear_history');
	await loadSpeedTestState();
}

export function listenToSpeedTestEvents() {
	listen<string>('speedtest-phase', (event) => {
		currentPhase.set(event.payload);
	});
	listen<SpeedTestResult>('speedtest-complete', (event) => {
		speedTestState.update((s) => ({
			...s,
			isRunning: false,
			lastResult: event.payload
		}));
	});
}
