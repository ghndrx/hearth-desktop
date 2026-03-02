<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	// Props
	let {
		compact = false
	}: {
		compact?: boolean;
	} = $props();

	interface WeatherLocation {
		id: string;
		name: string;
		lat: number;
		lon: number;
	}

	interface WeatherData {
		temp: number;
		feelsLike: number;
		humidity: number;
		windSpeed: number;
		condition: string;
		icon: string;
		high: number;
		low: number;
	}

	interface DailyForecast {
		day: string;
		high: number;
		low: number;
		icon: string;
		condition: string;
	}

	// State
	let locations = $state<WeatherLocation[]>([]);
	let activeLocationId = $state<string | null>(null);
	let weatherCache = $state<Record<string, WeatherData>>({});
	let forecastCache = $state<Record<string, DailyForecast[]>>({});
	let unit = $state<'F' | 'C'>('F');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let showAddLocation = $state(false);
	let searchQuery = $state('');
	let showDetails = $state(false);
	let lastUpdated = $state<Date | null>(null);

	const STORAGE_KEY = 'hearth-weather-widget';
	let refreshInterval: ReturnType<typeof setInterval>;

	// Preset cities for quick add
	const PRESET_CITIES: WeatherLocation[] = [
		{ id: 'nyc', name: 'New York', lat: 40.71, lon: -74.01 },
		{ id: 'lon', name: 'London', lat: 51.51, lon: -0.13 },
		{ id: 'tok', name: 'Tokyo', lat: 35.68, lon: 139.69 },
		{ id: 'par', name: 'Paris', lat: 48.86, lon: 2.35 },
		{ id: 'syd', name: 'Sydney', lat: -33.87, lon: 151.21 },
		{ id: 'sf', name: 'San Francisco', lat: 37.77, lon: -122.42 },
		{ id: 'ber', name: 'Berlin', lat: 52.52, lon: 13.41 },
		{ id: 'tor', name: 'Toronto', lat: 43.65, lon: -79.38 },
		{ id: 'sin', name: 'Singapore', lat: 1.35, lon: 103.82 },
		{ id: 'dub', name: 'Dubai', lat: 25.20, lon: 55.27 },
		{ id: 'mum', name: 'Mumbai', lat: 19.08, lon: 72.88 },
		{ id: 'mex', name: 'Mexico City', lat: 19.43, lon: -99.13 },
	];

	// Derived
	let activeLocation = $derived(locations.find(l => l.id === activeLocationId) ?? locations[0] ?? null);
	let activeWeather = $derived(activeLocation ? weatherCache[activeLocation.id] ?? null : null);
	let activeForecast = $derived(activeLocation ? forecastCache[activeLocation.id] ?? [] : []);
	let filteredPresets = $derived(
		searchQuery.trim()
			? PRESET_CITIES.filter(c =>
				c.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
				!locations.some(l => l.id === c.id)
			)
			: PRESET_CITIES.filter(c => !locations.some(l => l.id === c.id))
	);

	onMount(() => {
		loadPreferences();
		if (locations.length > 0) {
			refreshAllWeather();
		}
		// Refresh weather every 15 minutes
		refreshInterval = setInterval(refreshAllWeather, 15 * 60 * 1000);
	});

	onDestroy(() => {
		if (refreshInterval) clearInterval(refreshInterval);
	});

	function loadPreferences() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const prefs = JSON.parse(stored);
				locations = prefs.locations || [];
				activeLocationId = prefs.activeLocationId || (locations[0]?.id ?? null);
				unit = prefs.unit || 'F';
			}
		} catch {
			// Use defaults
		}
	}

	function savePreferences() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({
			locations,
			activeLocationId,
			unit
		}));
	}

	function addLocation(city: WeatherLocation) {
		if (locations.some(l => l.id === city.id)) return;
		locations = [...locations, city];
		if (!activeLocationId) activeLocationId = city.id;
		showAddLocation = false;
		searchQuery = '';
		savePreferences();
		fetchWeatherForLocation(city);
	}

	function removeLocation(id: string) {
		locations = locations.filter(l => l.id !== id);
		if (activeLocationId === id) {
			activeLocationId = locations[0]?.id ?? null;
		}
		const newCache = { ...weatherCache };
		delete newCache[id];
		weatherCache = newCache;
		const newForecast = { ...forecastCache };
		delete newForecast[id];
		forecastCache = newForecast;
		savePreferences();
	}

	function selectLocation(id: string) {
		activeLocationId = id;
		savePreferences();
	}

	function toggleUnit() {
		unit = unit === 'F' ? 'C' : 'F';
		savePreferences();
	}

	function convertTemp(tempF: number): number {
		if (unit === 'C') return Math.round((tempF - 32) * 5 / 9);
		return Math.round(tempF);
	}

	// Simulate weather data based on location and time
	function generateWeatherData(location: WeatherLocation): WeatherData {
		// Use lat/lon to seed pseudo-random but consistent weather
		const seed = Math.abs(location.lat * 100 + location.lon * 10) % 100;
		const hour = new Date().getHours();
		const month = new Date().getMonth();

		// Temperature varies by latitude (equator = warm, poles = cold)
		const baseTempLat = 75 - Math.abs(location.lat) * 0.8;
		// Seasonal variation (Northern hemisphere warmer in summer)
		const seasonalOffset = location.lat >= 0
			? Math.cos((month - 6) * Math.PI / 6) * 15
			: Math.cos(month * Math.PI / 6) * 15;
		// Daily variation
		const dailyOffset = Math.cos((hour - 14) * Math.PI / 12) * 8;

		const baseTemp = baseTempLat + seasonalOffset + dailyOffset;
		const temp = Math.round(baseTemp + (seed % 10) - 5);
		const humidity = Math.round(40 + (seed % 40) + (Math.abs(location.lon) % 20));
		const windSpeed = Math.round(5 + (seed % 15));

		const conditions = getConditionForSeed(seed, humidity);

		return {
			temp,
			feelsLike: Math.round(temp + (windSpeed > 10 ? -3 : 2)),
			humidity: Math.min(humidity, 99),
			windSpeed,
			condition: conditions.text,
			icon: conditions.icon,
			high: temp + Math.round(Math.random() * 5) + 3,
			low: temp - Math.round(Math.random() * 5) - 3
		};
	}

	function getConditionForSeed(seed: number, humidity: number): { text: string; icon: string } {
		if (humidity > 75) {
			if (seed % 4 === 0) return { text: 'Rainy', icon: '🌧️' };
			if (seed % 4 === 1) return { text: 'Stormy', icon: '⛈️' };
			return { text: 'Overcast', icon: '☁️' };
		}
		if (humidity > 55) {
			if (seed % 3 === 0) return { text: 'Partly Cloudy', icon: '⛅' };
			if (seed % 3 === 1) return { text: 'Cloudy', icon: '🌥️' };
			return { text: 'Mostly Cloudy', icon: '☁️' };
		}
		if (seed % 3 === 0) return { text: 'Sunny', icon: '☀️' };
		if (seed % 3 === 1) return { text: 'Clear', icon: '🌤️' };
		return { text: 'Fair', icon: '☀️' };
	}

	function generateForecast(location: WeatherLocation): DailyForecast[] {
		const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
		const today = new Date();
		const forecast: DailyForecast[] = [];

		for (let i = 1; i <= 5; i++) {
			const futureDate = new Date(today);
			futureDate.setDate(today.getDate() + i);
			const dayName = days[futureDate.getDay()];

			const seed = Math.abs(location.lat * 100 + location.lon * 10 + i * 7) % 100;
			const baseTempLat = 75 - Math.abs(location.lat) * 0.8;
			const high = Math.round(baseTempLat + (seed % 10));
			const low = high - Math.round(5 + (seed % 8));
			const humidity = 40 + (seed % 40);
			const conditions = getConditionForSeed(seed, humidity);

			forecast.push({
				day: dayName,
				high,
				low,
				icon: conditions.icon,
				condition: conditions.text
			});
		}

		return forecast;
	}

	async function fetchWeatherForLocation(location: WeatherLocation) {
		loading = true;
		error = null;
		try {
			// Simulate API latency
			await new Promise(r => setTimeout(r, 300));
			const data = generateWeatherData(location);
			weatherCache = { ...weatherCache, [location.id]: data };
			const forecast = generateForecast(location);
			forecastCache = { ...forecastCache, [location.id]: forecast };
			lastUpdated = new Date();
		} catch {
			error = 'Failed to fetch weather';
		} finally {
			loading = false;
		}
	}

	async function refreshAllWeather() {
		for (const location of locations) {
			await fetchWeatherForLocation(location);
		}
	}

	function getWindDirection(speed: number): string {
		const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
		return directions[speed % 8];
	}

	function formatLastUpdated(): string {
		if (!lastUpdated) return '';
		const mins = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
		if (mins < 1) return 'Just now';
		if (mins === 1) return '1 min ago';
		return `${mins} min ago`;
	}
</script>

<div class="weather-widget" class:compact>
	{#if locations.length === 0}
		<!-- Empty state -->
		<div class="empty-state">
			<div class="empty-icon">🌤️</div>
			<div class="empty-text">Add a city to see weather</div>
			<button class="add-btn" onclick={() => showAddLocation = true}>
				+ Add City
			</button>
		</div>
	{:else if activeWeather}
		<!-- Weather display -->
		<div class="weather-header">
			<div class="location-tabs">
				{#each locations as loc (loc.id)}
					<button
						class="location-tab"
						class:active={loc.id === activeLocationId}
						onclick={() => selectLocation(loc.id)}
						title={loc.name}
					>
						{compact ? loc.name.slice(0, 3) : loc.name}
					</button>
				{/each}
				{#if locations.length < 5}
					<button class="location-tab add-tab" onclick={() => showAddLocation = true} title="Add city">
						+
					</button>
				{/if}
			</div>
		</div>

		<div class="weather-main">
			<div class="weather-icon">{activeWeather.icon}</div>
			<div class="weather-temp">
				<span class="temp-value">{convertTemp(activeWeather.temp)}°</span>
				<button class="unit-toggle" onclick={toggleUnit} title="Toggle unit">
					{unit}
				</button>
			</div>
		</div>

		<div class="weather-condition">{activeWeather.condition}</div>

		{#if !compact}
			<div class="weather-range">
				H: {convertTemp(activeWeather.high)}° L: {convertTemp(activeWeather.low)}°
			</div>
		{/if}

		{#if showDetails && !compact}
			<div class="weather-details">
				<div class="detail-item">
					<span class="detail-label">Feels like</span>
					<span class="detail-value">{convertTemp(activeWeather.feelsLike)}°</span>
				</div>
				<div class="detail-item">
					<span class="detail-label">Humidity</span>
					<span class="detail-value">{activeWeather.humidity}%</span>
				</div>
				<div class="detail-item">
					<span class="detail-label">Wind</span>
					<span class="detail-value">{activeWeather.windSpeed} mph {getWindDirection(activeWeather.windSpeed)}</span>
				</div>
			</div>

			{#if activeForecast.length > 0}
				<div class="forecast">
					<div class="forecast-header">5-Day Forecast</div>
					<div class="forecast-list">
						{#each activeForecast as day}
							<div class="forecast-day">
								<span class="forecast-name">{day.day}</span>
								<span class="forecast-icon">{day.icon}</span>
								<span class="forecast-temps">
									<span class="forecast-high">{convertTemp(day.high)}°</span>
									<span class="forecast-low">{convertTemp(day.low)}°</span>
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if lastUpdated}
				<div class="last-updated">{formatLastUpdated()}</div>
			{/if}
		{/if}

		{#if !compact}
			<div class="weather-actions">
				<button class="action-btn" onclick={() => showDetails = !showDetails}>
					{showDetails ? '▲ Less' : '▼ More'}
				</button>
				<button class="action-btn" onclick={refreshAllWeather} title="Refresh" disabled={loading}>
					{loading ? '...' : '↻'}
				</button>
				{#if activeLocation}
					<button
						class="action-btn remove"
						onclick={() => removeLocation(activeLocation!.id)}
						title="Remove city"
					>
						×
					</button>
				{/if}
			</div>
		{/if}
	{:else if loading}
		<div class="loading">Loading weather...</div>
	{:else if error}
		<div class="error">{error}</div>
	{/if}

	{#if showAddLocation}
		<div class="add-location-panel">
			<div class="add-header">
				<span>Add City</span>
				<button class="close-btn" onclick={() => { showAddLocation = false; searchQuery = ''; }}>×</button>
			</div>
			<input
				type="text"
				class="search-input"
				placeholder="Search cities..."
				bind:value={searchQuery}
			/>
			<div class="city-list">
				{#each filteredPresets as city (city.id)}
					<button class="city-option" onclick={() => addLocation(city)}>
						{city.name}
					</button>
				{/each}
				{#if filteredPresets.length === 0}
					<div class="no-results">No matching cities</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.weather-widget {
		display: flex;
		flex-direction: column;
		gap: 6px;
		position: relative;
	}

	.empty-state {
		text-align: center;
		padding: 8px 0;
	}

	.empty-icon {
		font-size: 28px;
		margin-bottom: 4px;
	}

	.empty-text {
		font-size: 11px;
		color: var(--text-muted, #72767d);
		margin-bottom: 8px;
	}

	.add-btn {
		background: var(--accent, #5865f2);
		border: none;
		border-radius: 4px;
		color: white;
		padding: 4px 12px;
		font-size: 11px;
		cursor: pointer;
	}

	.add-btn:hover {
		opacity: 0.9;
	}

	.weather-header {
		display: flex;
		align-items: center;
	}

	.location-tabs {
		display: flex;
		gap: 2px;
		flex-wrap: wrap;
		width: 100%;
	}

	.location-tab {
		background: var(--bg-primary, #36393f);
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #72767d);
		padding: 2px 6px;
		font-size: 10px;
		cursor: pointer;
		white-space: nowrap;
	}

	.location-tab.active {
		background: var(--accent, #5865f2);
		color: white;
	}

	.location-tab:hover:not(.active) {
		color: var(--text-primary, #dcddde);
	}

	.location-tab.add-tab {
		color: var(--text-muted, #72767d);
		font-size: 12px;
		padding: 2px 6px;
	}

	.location-tab.add-tab:hover {
		background: var(--accent, #5865f2);
		color: white;
	}

	.weather-main {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}

	.weather-icon {
		font-size: 36px;
		line-height: 1;
	}

	.compact .weather-icon {
		font-size: 28px;
	}

	.weather-temp {
		display: flex;
		align-items: flex-start;
		gap: 2px;
	}

	.temp-value {
		font-size: 28px;
		font-weight: 700;
		color: var(--text-primary, #fff);
		line-height: 1;
	}

	.compact .temp-value {
		font-size: 22px;
	}

	.unit-toggle {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		font-size: 11px;
		cursor: pointer;
		padding: 0;
		margin-top: 2px;
	}

	.unit-toggle:hover {
		color: var(--text-primary, #dcddde);
	}

	.weather-condition {
		text-align: center;
		font-size: 12px;
		color: var(--text-secondary, #b9bbbe);
	}

	.weather-range {
		text-align: center;
		font-size: 11px;
		color: var(--text-muted, #72767d);
	}

	.weather-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px 0;
		border-top: 1px solid var(--bg-modifier-accent, #40444b);
		margin-top: 2px;
	}

	.detail-item {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
	}

	.detail-label {
		color: var(--text-muted, #72767d);
	}

	.detail-value {
		color: var(--text-secondary, #b9bbbe);
	}

	.forecast {
		border-top: 1px solid var(--bg-modifier-accent, #40444b);
		padding-top: 6px;
		margin-top: 2px;
	}

	.forecast-header {
		font-size: 10px;
		font-weight: 600;
		color: var(--text-muted, #72767d);
		text-transform: uppercase;
		margin-bottom: 4px;
	}

	.forecast-list {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.forecast-day {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
	}

	.forecast-name {
		width: 28px;
		color: var(--text-secondary, #b9bbbe);
	}

	.forecast-icon {
		font-size: 14px;
	}

	.forecast-temps {
		flex: 1;
		text-align: right;
		display: flex;
		gap: 6px;
		justify-content: flex-end;
	}

	.forecast-high {
		color: var(--text-primary, #dcddde);
		font-weight: 500;
	}

	.forecast-low {
		color: var(--text-muted, #72767d);
	}

	.last-updated {
		text-align: center;
		font-size: 9px;
		color: var(--text-muted, #72767d);
		margin-top: 2px;
	}

	.weather-actions {
		display: flex;
		justify-content: center;
		gap: 6px;
		margin-top: 2px;
	}

	.action-btn {
		background: var(--bg-primary, #36393f);
		border: none;
		border-radius: 4px;
		color: var(--text-muted, #72767d);
		padding: 2px 8px;
		font-size: 11px;
		cursor: pointer;
	}

	.action-btn:hover {
		color: var(--text-primary, #dcddde);
		background: var(--bg-modifier-hover, #4f545c);
	}

	.action-btn.remove:hover {
		color: var(--error, #ed4245);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.add-location-panel {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		background: var(--bg-secondary, #2f3136);
		border-radius: 8px;
		padding: 8px;
		z-index: 10;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		border: 1px solid var(--bg-modifier-accent, #40444b);
	}

	.add-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #dcddde);
		margin-bottom: 6px;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-muted, #72767d);
		font-size: 16px;
		cursor: pointer;
		padding: 0 4px;
	}

	.close-btn:hover {
		color: var(--text-primary, #dcddde);
	}

	.search-input {
		width: 100%;
		background: var(--bg-primary, #36393f);
		border: none;
		border-radius: 4px;
		padding: 6px 8px;
		font-size: 11px;
		color: var(--text-primary, #dcddde);
		margin-bottom: 6px;
		box-sizing: border-box;
	}

	.search-input::placeholder {
		color: var(--text-muted, #72767d);
	}

	.city-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-height: 150px;
		overflow-y: auto;
	}

	.city-option {
		background: var(--bg-primary, #36393f);
		border: none;
		border-radius: 4px;
		color: var(--text-secondary, #b9bbbe);
		padding: 6px 8px;
		font-size: 11px;
		cursor: pointer;
		text-align: left;
	}

	.city-option:hover {
		background: var(--accent, #5865f2);
		color: white;
	}

	.no-results {
		font-size: 11px;
		color: var(--text-muted, #72767d);
		text-align: center;
		padding: 8px;
	}

	.loading {
		font-size: 12px;
		color: var(--text-muted, #72767d);
		text-align: center;
		padding: 12px 0;
	}

	.error {
		font-size: 11px;
		color: var(--error, #ed4245);
		text-align: center;
		padding: 8px 0;
	}
</style>
