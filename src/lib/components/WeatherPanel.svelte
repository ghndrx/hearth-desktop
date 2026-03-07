<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface WeatherLocation {
		name: string;
		country: string;
		latitude: number;
		longitude: number;
	}

	interface WeatherData {
		location: WeatherLocation;
		temperatureC: number;
		temperatureF: number;
		weatherCode: number;
		weatherDescription: string;
		windSpeedKmh: number;
		humidity: number;
		isDay: boolean;
		fetchedAt: number;
	}

	interface GeoResult {
		name: string;
		country: string;
		latitude: number;
		longitude: number;
		admin1: string | null;
	}

	let weather = $state<WeatherData | null>(null);
	let searchQuery = $state('');
	let searchResults = $state<GeoResult[]>([]);
	let searching = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let useFahrenheit = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(async () => {
		try {
			const cached = await invoke<WeatherData | null>('weather_get_cached');
			if (cached) {
				weather = cached;
				// Refresh if older than 10 minutes
				const age = Date.now() / 1000 - cached.fetchedAt;
				if (age > 600) {
					await fetchWeather(cached.location);
				}
			} else {
				const loc = await invoke<WeatherLocation | null>('weather_get_location');
				if (loc) await fetchWeather(loc);
			}
		} catch (e) {
			error = String(e);
		}
	});

	function handleSearchInput() {
		if (searchTimeout) clearTimeout(searchTimeout);
		if (searchQuery.trim().length < 2) {
			searchResults = [];
			return;
		}
		searching = true;
		searchTimeout = setTimeout(async () => {
			try {
				searchResults = await invoke<GeoResult[]>('weather_search_city', { query: searchQuery });
			} catch (e) {
				error = String(e);
			} finally {
				searching = false;
			}
		}, 400);
	}

	async function selectCity(result: GeoResult) {
		searchQuery = '';
		searchResults = [];
		error = null;

		const loc: WeatherLocation = {
			name: result.name,
			country: result.country,
			latitude: result.latitude,
			longitude: result.longitude,
		};

		await invoke('weather_set_location', loc);
		await fetchWeather(loc);
	}

	async function fetchWeather(loc: WeatherLocation) {
		loading = true;
		error = null;
		try {
			weather = await invoke<WeatherData>('weather_fetch', {
				latitude: loc.latitude,
				longitude: loc.longitude,
				name: loc.name,
				country: loc.country,
			});
		} catch (e) {
			error = String(e);
		} finally {
			loading = false;
		}
	}

	async function clearLocation() {
		await invoke('weather_clear_location');
		weather = null;
	}

	function weatherIcon(code: number, isDay: boolean): string {
		if (code === 0) return isDay ? '\u2600' : '\uD83C\uDF19';
		if (code <= 2) return isDay ? '\u26C5' : '\uD83C\uDF19';
		if (code === 3) return '\u2601';
		if (code <= 48) return '\uD83C\uDF2B';
		if (code <= 57) return '\uD83C\uDF27';
		if (code <= 67) return '\uD83C\uDF27';
		if (code <= 77) return '\u2744';
		if (code <= 82) return '\uD83C\uDF26';
		if (code <= 86) return '\uD83C\uDF28';
		return '\u26A1';
	}

	function formatTemp(c: number, f: number): string {
		return useFahrenheit ? `${Math.round(f)}\u00B0F` : `${Math.round(c)}\u00B0C`;
	}

	function timeSince(epoch: number): string {
		const secs = Math.floor(Date.now() / 1000 - epoch);
		if (secs < 60) return 'just now';
		if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
		return `${Math.floor(secs / 3600)}h ago`;
	}
</script>

<div class="weather-panel">
	<div class="panel-header">
		<div class="header-left">
			<span class="header-icon">{weather ? weatherIcon(weather.weatherCode, weather.isDay) : '\u2601'}</span>
			<h3>Weather</h3>
		</div>
		<div class="header-actions">
			{#if weather}
				<button class="icon-btn" onclick={() => fetchWeather(weather!.location)} title="Refresh" disabled={loading}>
					&#x21BB;
				</button>
				<button class="icon-btn" onclick={() => useFahrenheit = !useFahrenheit} title="Toggle unit">
					{useFahrenheit ? '\u00B0F' : '\u00B0C'}
				</button>
			{/if}
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	<div class="search-container">
		<input
			type="text"
			class="search-input"
			placeholder="Search city..."
			bind:value={searchQuery}
			oninput={handleSearchInput}
		/>
		{#if searching}
			<span class="search-spinner">...</span>
		{/if}
	</div>

	{#if searchResults.length > 0}
		<div class="search-results">
			{#each searchResults as result}
				<button class="result-item" onclick={() => selectCity(result)}>
					<span class="result-name">{result.name}</span>
					<span class="result-detail">
						{result.admin1 ? `${result.admin1}, ` : ''}{result.country}
					</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if loading && !weather}
		<div class="loading">Loading weather...</div>
	{:else if weather}
		<div class="weather-card" class:night={!weather.isDay}>
			<div class="weather-main">
				<span class="weather-icon">{weatherIcon(weather.weatherCode, weather.isDay)}</span>
				<span class="weather-temp">{formatTemp(weather.temperatureC, weather.temperatureF)}</span>
			</div>
			<div class="weather-desc">{weather.weatherDescription}</div>
			<div class="weather-location">
				{weather.location.name}, {weather.location.country}
				<button class="clear-btn" onclick={clearLocation} title="Remove location">&#x2715;</button>
			</div>
			<div class="weather-details">
				<div class="detail">
					<span class="detail-label">Wind</span>
					<span class="detail-value">{Math.round(weather.windSpeedKmh)} km/h</span>
				</div>
				<div class="detail">
					<span class="detail-label">Humidity</span>
					<span class="detail-value">{Math.round(weather.humidity)}%</span>
				</div>
			</div>
			<div class="weather-updated">Updated {timeSince(weather.fetchedAt)}</div>
		</div>
	{:else}
		<div class="empty-state">
			Search for a city above to see current weather.
		</div>
	{/if}
</div>

<style>
	.weather-panel {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 16px;
		background: var(--bg-secondary, #2b2d31);
		border-radius: 8px;
		color: var(--text-primary, #dbdee1);
		font-family: inherit;
	}

	.panel-header { display: flex; align-items: center; justify-content: space-between; }
	.header-left { display: flex; align-items: center; gap: 8px; }
	.header-icon { font-size: 18px; }
	h3 { margin: 0; font-size: 14px; font-weight: 600; }
	.header-actions { display: flex; gap: 4px; }

	.icon-btn {
		padding: 4px 8px; border-radius: 4px; border: none;
		background: transparent; color: var(--text-secondary, #949ba4);
		font-size: 12px; cursor: pointer;
	}
	.icon-btn:hover { background: var(--bg-tertiary, #1e1f22); color: var(--text-primary, #dbdee1); }
	.icon-btn:disabled { opacity: 0.5; cursor: default; }

	.error { font-size: 12px; color: #ed4245; }

	.search-container { position: relative; }
	.search-input {
		width: 100%; padding: 8px 10px; border-radius: 6px;
		border: 1px solid var(--border, #3f4147);
		background: var(--bg-tertiary, #1e1f22);
		color: var(--text-primary, #dbdee1); font-size: 12px;
		box-sizing: border-box;
	}
	.search-input:focus { outline: none; border-color: #5865f2; }
	.search-spinner {
		position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
		color: var(--text-muted, #6d6f78); font-size: 12px;
	}

	.search-results {
		display: flex; flex-direction: column;
		border: 1px solid var(--border, #3f4147); border-radius: 6px;
		background: var(--bg-tertiary, #1e1f22); overflow: hidden;
	}
	.result-item {
		display: flex; flex-direction: column; gap: 2px;
		padding: 8px 10px; border: none; background: none;
		color: var(--text-primary, #dbdee1); cursor: pointer;
		text-align: left;
	}
	.result-item:hover { background: rgba(88, 101, 242, 0.1); }
	.result-item + .result-item { border-top: 1px solid var(--border, #3f4147); }
	.result-name { font-size: 12px; font-weight: 500; }
	.result-detail { font-size: 10px; color: var(--text-muted, #6d6f78); }

	.loading {
		text-align: center; padding: 24px 16px;
		font-size: 12px; color: var(--text-muted, #6d6f78);
	}

	.weather-card {
		padding: 16px; border-radius: 8px;
		background: linear-gradient(135deg, #4a90d9 0%, #67b8f0 100%);
		color: white;
	}
	.weather-card.night {
		background: linear-gradient(135deg, #2c3e6b 0%, #1a2744 100%);
	}

	.weather-main {
		display: flex; align-items: center; gap: 12px; margin-bottom: 4px;
	}
	.weather-icon { font-size: 40px; line-height: 1; }
	.weather-temp { font-size: 36px; font-weight: 700; }

	.weather-desc {
		font-size: 14px; opacity: 0.9; margin-bottom: 8px;
	}

	.weather-location {
		display: flex; align-items: center; gap: 6px;
		font-size: 11px; opacity: 0.8; margin-bottom: 12px;
	}
	.clear-btn {
		background: none; border: none; color: rgba(255,255,255,0.6);
		font-size: 10px; cursor: pointer; padding: 2px 4px; border-radius: 3px;
	}
	.clear-btn:hover { color: white; background: rgba(255,255,255,0.15); }

	.weather-details {
		display: flex; gap: 16px; margin-bottom: 8px;
	}
	.detail { display: flex; flex-direction: column; gap: 2px; }
	.detail-label { font-size: 10px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.5px; }
	.detail-value { font-size: 13px; font-weight: 500; }

	.weather-updated {
		font-size: 10px; opacity: 0.5; text-align: right;
	}

	.empty-state {
		text-align: center; padding: 24px 16px;
		font-size: 12px; color: var(--text-muted, #6d6f78);
	}
</style>
