<!--
IdleStatus.svelte - Example component showing how to use the idle time detection API
-->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { getIdleTime, createIdleMonitor, formatIdleTime, type IdleInfo } from '../idle';

    let idleInfo: IdleInfo | null = null;
    let error: string | null = null;
    let isLoading = true;
    let stopMonitoring: (() => void) | null = null;

    onMount(async () => {
        try {
            // Get initial idle state
            idleInfo = await getIdleTime();
            isLoading = false;

            // Start monitoring for changes
            stopMonitoring = createIdleMonitor((isIdle, idleSeconds) => {
                console.log(`Idle state changed: ${isIdle ? 'IDLE' : 'ACTIVE'} (${formatIdleTime(idleSeconds)})`);
                // Update the idle info to reflect current state
                if (idleInfo) {
                    idleInfo = { ...idleInfo, is_idle: isIdle, idle_seconds: idleSeconds };
                }
            });
        } catch (err) {
            error = err instanceof Error ? err.message : 'Failed to get idle time';
            isLoading = false;
        }
    });

    onDestroy(() => {
        if (stopMonitoring) {
            stopMonitoring();
        }
    });
</script>

<div class="idle-status">
    {#if isLoading}
        <div class="loading">Loading idle status...</div>
    {:else if error}
        <div class="error">Error: {error}</div>
    {:else if idleInfo}
        <div class="idle-info">
            <div class="status" class:idle={idleInfo.is_idle} class:active={!idleInfo.is_idle}>
                Status: {idleInfo.is_idle ? 'IDLE' : 'ACTIVE'}
            </div>
            <div class="time">
                Idle time: {formatIdleTime(idleInfo.idle_seconds)}
            </div>
            <div class="platform">
                Platform: {idleInfo.platform}
            </div>
        </div>
    {/if}
</div>

<style>
    .idle-status {
        padding: 1rem;
        border: 1px solid #e5e5e5;
        border-radius: 0.5rem;
        background-color: #f9f9f9;
        max-width: 300px;
    }

    .loading, .error {
        padding: 0.5rem;
        text-align: center;
    }

    .error {
        color: #d32f2f;
        background-color: #ffebee;
        border-radius: 0.25rem;
    }

    .idle-info {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .status {
        font-weight: bold;
        padding: 0.5rem;
        border-radius: 0.25rem;
        text-align: center;
        transition: all 0.3s ease;
    }

    .status.active {
        background-color: #e8f5e8;
        color: #2e7d32;
    }

    .status.idle {
        background-color: #fff3e0;
        color: #f57c00;
    }

    .time, .platform {
        font-size: 0.9rem;
        color: #666;
    }
</style>