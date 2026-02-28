/**
 * System health state store.
 *
 * Holds the latest system-wide resource snapshot emitted by the Rust
 * background monitor. Components can subscribe to this to display
 * live CPU, memory, and disk usage.
 */
import { writable, derived } from 'svelte/store';

export interface SystemHealthState {
	cpuUsage: number;
	cpuCores: number;
	memoryTotal: number;
	memoryUsed: number;
	memoryPercent: number;
	diskAvailable: number;
	diskTotal: number;
	diskPercent: number;
	loadAverage: [number, number, number];
	systemUptime: number;
	monitorActive: boolean;
	lastUpdated: number;
}

const initialState: SystemHealthState = {
	cpuUsage: 0,
	cpuCores: 0,
	memoryTotal: 0,
	memoryUsed: 0,
	memoryPercent: 0,
	diskAvailable: 0,
	diskTotal: 0,
	diskPercent: 0,
	loadAverage: [0, 0, 0],
	systemUptime: 0,
	monitorActive: false,
	lastUpdated: 0
};

function createSystemHealthStore() {
	const { subscribe, update, set } = writable<SystemHealthState>(initialState);

	return {
		subscribe,

		updateHealth(snapshot: {
			cpu_usage: number;
			cpu_cores: number;
			memory_total: number;
			memory_used: number;
			memory_percent: number;
			disk_available: number;
			disk_total: number;
			disk_percent: number;
			load_average: [number, number, number];
			system_uptime: number;
			timestamp: number;
		}) {
			update((s) => ({
				...s,
				cpuUsage: snapshot.cpu_usage,
				cpuCores: snapshot.cpu_cores,
				memoryTotal: snapshot.memory_total,
				memoryUsed: snapshot.memory_used,
				memoryPercent: snapshot.memory_percent,
				diskAvailable: snapshot.disk_available,
				diskTotal: snapshot.disk_total,
				diskPercent: snapshot.disk_percent,
				loadAverage: snapshot.load_average,
				systemUptime: snapshot.system_uptime,
				lastUpdated: snapshot.timestamp
			}));
		},

		setMonitorActive(active: boolean) {
			update((s) => ({ ...s, monitorActive: active }));
		},

		reset() {
			set(initialState);
		}
	};
}

export const systemHealth = createSystemHealthStore();

/** True when memory usage exceeds 85% */
export const memoryWarning = derived(systemHealth, ($s) => $s.memoryPercent > 85);

/** True when disk usage exceeds 90% */
export const diskWarning = derived(systemHealth, ($s) => $s.diskPercent > 90);
