import { invoke } from '@tauri-apps/api/core';

/**
 * Information about the current system idle state
 */
export interface IdleInfo {
    /** Current idle time in seconds */
    idle_seconds: number;
    /** Whether the system is currently idle (based on threshold) */
    is_idle: boolean;
    /** Platform-specific implementation used */
    platform: string;
}

/**
 * Default idle threshold in seconds (5 minutes)
 */
export const DEFAULT_IDLE_THRESHOLD = 300;

/**
 * Get the current system idle time information
 * @returns Promise that resolves to idle information
 */
export async function getIdleTime(): Promise<IdleInfo> {
    return invoke<IdleInfo>('get_idle_time');
}

/**
 * Get the current system idle time with custom threshold
 * @param thresholdSeconds Custom threshold in seconds to determine if system is idle
 * @returns Promise that resolves to idle information
 */
export async function getIdleTimeWithThreshold(thresholdSeconds: number): Promise<IdleInfo> {
    return invoke<IdleInfo>('get_idle_time_with_threshold', { thresholdSeconds });
}

/**
 * Check if the system is currently idle (uses default 5-minute threshold)
 * @returns Promise that resolves to true if system is idle
 */
export async function isSystemIdle(): Promise<boolean> {
    return invoke<boolean>('is_system_idle');
}

/**
 * Get just the idle time in seconds
 * @returns Promise that resolves to idle time in seconds
 */
export async function getIdleSeconds(): Promise<number> {
    return invoke<number>('get_idle_seconds');
}

/**
 * Create an idle monitor that calls a callback when idle state changes
 * @param callback Function to call when idle state changes
 * @param thresholdSeconds Idle threshold in seconds (default: 300)
 * @param checkIntervalMs How often to check in milliseconds (default: 5000)
 * @returns Function to stop monitoring
 */
export function createIdleMonitor(
    callback: (isIdle: boolean, idleSeconds: number) => void,
    thresholdSeconds: number = DEFAULT_IDLE_THRESHOLD,
    checkIntervalMs: number = 5000
): () => void {
    let lastIdleState: boolean | null = null;

    const interval = setInterval(async () => {
        try {
            const idleInfo = await getIdleTimeWithThreshold(thresholdSeconds);

            if (lastIdleState !== idleInfo.is_idle) {
                lastIdleState = idleInfo.is_idle;
                callback(idleInfo.is_idle, idleInfo.idle_seconds);
            }
        } catch (error) {
            console.error('Failed to check idle state:', error);
        }
    }, checkIntervalMs);

    return () => clearInterval(interval);
}

/**
 * Utility to format idle time as a human-readable string
 * @param seconds Idle time in seconds
 * @returns Formatted string like "2h 15m 30s"
 */
export function formatIdleTime(seconds: number): string {
    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
        return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    let result = `${hours}h`;
    if (remainingMinutes > 0) {
        result += ` ${remainingMinutes}m`;
    }
    if (remainingSeconds > 0) {
        result += ` ${remainingSeconds}s`;
    }

    return result;
}