<script lang="ts">
	import { onMount } from 'svelte';
	import { invoke } from '@tauri-apps/api/core';

	interface NotificationPrefs {
		enabled: boolean;
		soundEnabled: boolean;
		badgeEnabled: boolean;
		bannerStyle: 'banner' | 'alert' | 'none';
		groupByChannel: boolean;
		showPreview: boolean;
		quietHoursEnabled: boolean;
		quietHoursStart: string;
		quietHoursEnd: string;
		flashTaskbar: boolean;
		flashDuration: number;
		urgentOnly: boolean;
	}

	let { open = $bindable(false), onClose }: { open?: boolean; onClose?: () => void } = $props();

	let prefs = $state<NotificationPrefs>({
		enabled: true,
		soundEnabled: true,
		badgeEnabled: true,
		bannerStyle: 'banner',
		groupByChannel: true,
		showPreview: true,
		quietHoursEnabled: false,
		quietHoursStart: '22:00',
		quietHoursEnd: '08:00',
		flashTaskbar: true,
		flashDuration: 3,
		urgentOnly: false
	});
	let testSent = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		try {
			const saved = await invoke<string | null>('plugin:store|get', { key: 'notification_prefs' });
			if (saved) {
				prefs = { ...prefs, ...JSON.parse(saved) };
			}
		} catch {
			// Use defaults
		}
	});

	async function savePrefs() {
		try {
			error = null;
			await invoke('plugin:store|set', { key: 'notification_prefs', value: JSON.stringify(prefs) });
		} catch (e) {
			error = String(e);
		}
	}

	async function sendTestNotification() {
		try {
			error = null;
			await invoke('show_notification', {
				title: 'Hearth Desktop',
				body: 'This is a test notification. Your settings are working correctly!'
			});
			testSent = true;
			setTimeout(() => testSent = false, 3000);
		} catch (e) {
			error = String(e);
		}
	}

	function updatePref<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) {
		prefs = { ...prefs, [key]: value };
		savePrefs();
	}

	const bannerStyles = [
		{ value: 'banner', label: 'Banner', desc: 'Brief popup that auto-dismisses' },
		{ value: 'alert', label: 'Alert', desc: 'Stays until dismissed' },
		{ value: 'none', label: 'None', desc: 'No visual notification' },
	] as const;
</script>

{#if open}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
		<div class="bg-gray-900 rounded-xl border border-gray-700 w-[520px] max-h-[85vh] flex flex-col shadow-2xl">
			<!-- Header -->
			<div class="flex items-center justify-between px-5 py-4 border-b border-gray-700">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
						<svg class="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
						</svg>
					</div>
					<div>
						<h2 class="text-white font-semibold text-sm">Notification Preferences</h2>
						<p class="text-gray-400 text-xs">Configure native desktop notifications</p>
					</div>
				</div>
				<button
					class="w-7 h-7 rounded-lg hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
					onclick={() => { open = false; onClose?.(); }}
					aria-label="Close notification preferences"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-5 space-y-4">
				<!-- Master Toggle -->
				<div class="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4">
					<label class="flex items-center justify-between cursor-pointer">
						<div>
							<span class="text-sm text-gray-300 block font-medium">Enable Notifications</span>
							<span class="text-xs text-gray-500">Show native OS notifications for messages</span>
						</div>
						<button
							role="switch"
							aria-checked={prefs.enabled}
							class="w-10 h-5 rounded-full transition-colors {prefs.enabled ? 'bg-rose-500' : 'bg-gray-600'}"
							onclick={() => updatePref('enabled', !prefs.enabled)}
						>
							<span class="block w-4 h-4 bg-white rounded-full shadow transition-transform {prefs.enabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5"></span>
						</button>
					</label>
				</div>

				{#if prefs.enabled}
					<!-- Display Settings -->
					<div>
						<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Display</h3>
						<div class="bg-gray-800/50 rounded-lg border border-gray-700/50 divide-y divide-gray-700/50">
							<!-- Banner Style -->
							<div class="p-4">
								<span class="text-sm text-gray-300 block mb-2">Banner Style</span>
								<div class="grid grid-cols-3 gap-2">
									{#each bannerStyles as style}
										<button
											class="p-2 rounded-lg border text-center transition-colors {prefs.bannerStyle === style.value ? 'border-rose-500/50 bg-rose-500/10' : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'}"
											onclick={() => updatePref('bannerStyle', style.value)}
										>
											<span class="text-xs font-medium {prefs.bannerStyle === style.value ? 'text-rose-400' : 'text-gray-300'}">{style.label}</span>
											<span class="text-[10px] text-gray-500 block mt-0.5">{style.desc}</span>
										</button>
									{/each}
								</div>
							</div>

							<!-- Show Preview -->
							<div class="p-4">
								<label class="flex items-center justify-between cursor-pointer">
									<div>
										<span class="text-sm text-gray-300">Show Message Preview</span>
										<span class="text-xs text-gray-500 block">Display message content in notifications</span>
									</div>
									<button
										role="switch"
										aria-checked={prefs.showPreview}
										class="w-10 h-5 rounded-full transition-colors {prefs.showPreview ? 'bg-rose-500' : 'bg-gray-600'}"
										onclick={() => updatePref('showPreview', !prefs.showPreview)}
									>
										<span class="block w-4 h-4 bg-white rounded-full shadow transition-transform {prefs.showPreview ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5"></span>
									</button>
								</label>
							</div>

							<!-- Group by Channel -->
							<div class="p-4">
								<label class="flex items-center justify-between cursor-pointer">
									<div>
										<span class="text-sm text-gray-300">Group by Channel</span>
										<span class="text-xs text-gray-500 block">Stack notifications from the same channel</span>
									</div>
									<button
										role="switch"
										aria-checked={prefs.groupByChannel}
										class="w-10 h-5 rounded-full transition-colors {prefs.groupByChannel ? 'bg-rose-500' : 'bg-gray-600'}"
										onclick={() => updatePref('groupByChannel', !prefs.groupByChannel)}
									>
										<span class="block w-4 h-4 bg-white rounded-full shadow transition-transform {prefs.groupByChannel ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5"></span>
									</button>
								</label>
							</div>
						</div>
					</div>

					<!-- Sound & Badge -->
					<div>
						<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Alerts</h3>
						<div class="bg-gray-800/50 rounded-lg border border-gray-700/50 divide-y divide-gray-700/50">
							<div class="p-4">
								<label class="flex items-center justify-between cursor-pointer">
									<span class="text-sm text-gray-300">Notification Sound</span>
									<button
										role="switch"
										aria-checked={prefs.soundEnabled}
										class="w-10 h-5 rounded-full transition-colors {prefs.soundEnabled ? 'bg-rose-500' : 'bg-gray-600'}"
										onclick={() => updatePref('soundEnabled', !prefs.soundEnabled)}
									>
										<span class="block w-4 h-4 bg-white rounded-full shadow transition-transform {prefs.soundEnabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5"></span>
									</button>
								</label>
							</div>
							<div class="p-4">
								<label class="flex items-center justify-between cursor-pointer">
									<span class="text-sm text-gray-300">App Badge Count</span>
									<button
										role="switch"
										aria-checked={prefs.badgeEnabled}
										class="w-10 h-5 rounded-full transition-colors {prefs.badgeEnabled ? 'bg-rose-500' : 'bg-gray-600'}"
										onclick={() => updatePref('badgeEnabled', !prefs.badgeEnabled)}
									>
										<span class="block w-4 h-4 bg-white rounded-full shadow transition-transform {prefs.badgeEnabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5"></span>
									</button>
								</label>
							</div>
							<div class="p-4">
								<label class="flex items-center justify-between cursor-pointer">
									<div>
										<span class="text-sm text-gray-300">Flash Taskbar</span>
										<span class="text-xs text-gray-500 block">Flash taskbar icon on new messages</span>
									</div>
									<button
										role="switch"
										aria-checked={prefs.flashTaskbar}
										class="w-10 h-5 rounded-full transition-colors {prefs.flashTaskbar ? 'bg-rose-500' : 'bg-gray-600'}"
										onclick={() => updatePref('flashTaskbar', !prefs.flashTaskbar)}
									>
										<span class="block w-4 h-4 bg-white rounded-full shadow transition-transform {prefs.flashTaskbar ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5"></span>
									</button>
								</label>
							</div>
						</div>
					</div>

					<!-- Quiet Hours -->
					<div>
						<h3 class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Quiet Hours</h3>
						<div class="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4 space-y-3">
							<label class="flex items-center justify-between cursor-pointer">
								<div>
									<span class="text-sm text-gray-300">Enable Quiet Hours</span>
									<span class="text-xs text-gray-500 block">Suppress notifications during set hours</span>
								</div>
								<button
									role="switch"
									aria-checked={prefs.quietHoursEnabled}
									class="w-10 h-5 rounded-full transition-colors {prefs.quietHoursEnabled ? 'bg-rose-500' : 'bg-gray-600'}"
									onclick={() => updatePref('quietHoursEnabled', !prefs.quietHoursEnabled)}
								>
									<span class="block w-4 h-4 bg-white rounded-full shadow transition-transform {prefs.quietHoursEnabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5"></span>
								</button>
							</label>
							{#if prefs.quietHoursEnabled}
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="text-xs text-gray-500 block mb-1" for="quiet-start">Start</label>
										<input
											id="quiet-start"
											type="time"
											bind:value={prefs.quietHoursStart}
											onchange={() => savePrefs()}
											class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
										/>
									</div>
									<div>
										<label class="text-xs text-gray-500 block mb-1" for="quiet-end">End</label>
										<input
											id="quiet-end"
											type="time"
											bind:value={prefs.quietHoursEnd}
											onchange={() => savePrefs()}
											class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500"
										/>
									</div>
								</div>
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										bind:checked={prefs.urgentOnly}
										onchange={() => savePrefs()}
										class="rounded border-gray-600 bg-gray-800 text-rose-500 focus:ring-rose-500"
									/>
									<span class="text-xs text-gray-400">Allow urgent/mention notifications during quiet hours</span>
								</label>
							{/if}
						</div>
					</div>

					<!-- Test -->
					<button
						class="w-full px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors"
						onclick={sendTestNotification}
					>
						{testSent ? 'Notification Sent!' : 'Send Test Notification'}
					</button>
				{/if}

				{#if error}
					<div class="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
						<p class="text-sm text-red-400">{error}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
