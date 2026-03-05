<script lang="ts">
	import { onMount } from 'svelte';
	import {
		speedTestState,
		currentPhase,
		isTestRunning,
		lastResult,
		testHistory,
		runSpeedTest,
		loadSpeedTestState,
		clearSpeedTestHistory,
		listenToSpeedTestEvents,
		type SpeedTestResult
	} from '$lib/stores/speedTest';

	let error = '';

	onMount(() => {
		loadSpeedTestState();
		listenToSpeedTestEvents();
	});

	async function handleRunTest() {
		error = '';
		try {
			await runSpeedTest();
		} catch (e) {
			error = String(e);
		}
	}

	function qualityColor(quality: string): string {
		switch (quality) {
			case 'Excellent': return 'text-green-400';
			case 'Very Good': return 'text-emerald-400';
			case 'Good': return 'text-yellow-400';
			case 'Fair': return 'text-orange-400';
			case 'Poor': return 'text-red-400';
			default: return 'text-dark-300';
		}
	}

	function phaseLabel(phase: string): string {
		switch (phase) {
			case 'latency': return 'Measuring latency...';
			case 'download': return 'Testing download speed...';
			case 'upload': return 'Testing upload speed...';
			default: return 'Preparing...';
		}
	}

	function formatDate(ts: string): string {
		return new Date(ts).toLocaleString();
	}
</script>

<div class="flex h-full flex-col bg-dark-800 text-gray-100">
	<div class="flex items-center justify-between border-b border-dark-600 px-4 py-3">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 text-hearth-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
			</svg>
			<h2 class="text-lg font-semibold">Speed Test</h2>
		</div>
		{#if $testHistory.length > 0}
			<button
				onclick={clearSpeedTestHistory}
				class="rounded bg-dark-600 px-3 py-1 text-xs hover:bg-dark-500"
			>Clear History</button>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		<div class="mb-6 flex flex-col items-center gap-4">
			<button
				onclick={handleRunTest}
				disabled={$isTestRunning}
				class="h-28 w-28 rounded-full bg-hearth-500 text-lg font-bold transition-all hover:bg-hearth-600 hover:shadow-lg disabled:animate-pulse disabled:bg-hearth-700"
			>
				{$isTestRunning ? 'Testing' : 'GO'}
			</button>

			{#if $isTestRunning}
				<p class="text-sm text-hearth-300">{phaseLabel($currentPhase)}</p>
			{/if}

			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}
		</div>

		{#if $lastResult}
			<div class="mb-6 rounded-lg bg-dark-700 p-5">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="text-sm font-medium text-dark-200">Latest Result</h3>
					<span class={`text-sm font-medium ${qualityColor($lastResult.quality)}`}>{$lastResult.quality}</span>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div class="text-center">
						<p class="text-3xl font-bold text-hearth-400">{$lastResult.downloadMbps}</p>
						<p class="text-xs text-dark-400">Download Mbps</p>
					</div>
					<div class="text-center">
						<p class="text-3xl font-bold text-blue-400">{$lastResult.uploadMbps}</p>
						<p class="text-xs text-dark-400">Upload Mbps</p>
					</div>
					<div class="text-center">
						<p class="text-xl font-semibold text-green-400">{$lastResult.latencyMs}</p>
						<p class="text-xs text-dark-400">Latency ms</p>
					</div>
					<div class="text-center">
						<p class="text-xl font-semibold text-yellow-400">{$lastResult.jitterMs}</p>
						<p class="text-xs text-dark-400">Jitter ms</p>
					</div>
				</div>
			</div>
		{/if}

		{#if $speedTestState.averageDownload > 0}
			<div class="mb-6 rounded-lg bg-dark-700 p-4">
				<h3 class="mb-2 text-sm font-medium text-dark-200">Averages ({$speedTestState.history.length} tests)</h3>
				<div class="grid grid-cols-3 gap-3 text-center text-sm">
					<div>
						<p class="font-semibold text-hearth-400">{$speedTestState.averageDownload.toFixed(1)}</p>
						<p class="text-xs text-dark-400">Avg Download</p>
					</div>
					<div>
						<p class="font-semibold text-blue-400">{$speedTestState.averageUpload.toFixed(1)}</p>
						<p class="text-xs text-dark-400">Avg Upload</p>
					</div>
					<div>
						<p class="font-semibold text-green-400">{$speedTestState.averageLatency.toFixed(1)}</p>
						<p class="text-xs text-dark-400">Avg Latency</p>
					</div>
				</div>
			</div>
		{/if}

		{#if $testHistory.length > 1}
			<div class="rounded-lg bg-dark-700 p-4">
				<h3 class="mb-3 text-sm font-medium text-dark-200">History</h3>
				<div class="flex flex-col gap-2">
					{#each [...$testHistory].reverse().slice(0, 10) as test}
						<div class="flex items-center justify-between rounded bg-dark-600 px-3 py-2 text-xs">
							<span class="text-dark-300">{formatDate(test.timestamp)}</span>
							<div class="flex gap-3">
								<span class="text-hearth-400">{test.downloadMbps} Mbps</span>
								<span class="text-blue-400">{test.uploadMbps} Mbps</span>
								<span class="text-green-400">{test.latencyMs} ms</span>
								<span class={qualityColor(test.quality)}>{test.quality}</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
