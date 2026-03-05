<script lang="ts">
	import { printManager, type PrintSettings } from '$lib/stores/printManager';
	import { onMount } from 'svelte';

	export let contentHtml = '';
	export let title = 'Chat Messages';
	export let onClose: () => void = () => {};

	let settings: PrintSettings;
	let previewHtml = '';
	let estimatedPages = 0;
	let isGenerating = false;
	let activeTab: 'preview' | 'settings' = 'preview';

	const paperSizes = ['A4', 'Letter', 'Legal', 'A3', 'A5'];
	const orientations = ['portrait', 'landscape'];
	const themes = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'high_contrast', label: 'High Contrast' }
	];

	onMount(async () => {
		await printManager.loadSettings();
		const unsub = printManager.settings.subscribe((s) => {
			settings = { ...s };
		});
		await generatePreview();
		return unsub;
	});

	async function generatePreview() {
		if (!contentHtml) return;
		isGenerating = true;
		try {
			const preview = await printManager.generatePreview(contentHtml, settings);
			if (preview) {
				previewHtml = preview.html;
				estimatedPages = preview.estimated_pages;
			}
		} catch {
			// Preview generation failed
		}
		isGenerating = false;
	}

	async function handlePrint() {
		await printManager.createJob(title, 'chat_messages');
		printManager.printWindow();
	}

	async function handleExportPdf() {
		try {
			const { save } = await import('@tauri-apps/plugin-dialog');
			const path = await save({
				defaultPath: `${title.replace(/\s+/g, '_')}.html`,
				filters: [{ name: 'HTML', extensions: ['html'] }]
			});
			if (path) {
				await printManager.exportPdf(contentHtml, path, settings);
			}
		} catch {
			// Export failed or cancelled
		}
	}

	async function handleSettingChange() {
		await printManager.updateSettings(settings);
		await generatePreview();
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-label="Print dialog">
	<div class="bg-[#313338] rounded-lg shadow-xl w-[900px] max-h-[85vh] flex flex-col">
		<div class="flex items-center justify-between px-6 py-4 border-b border-[#3f4147]">
			<h2 class="text-lg font-semibold text-white">Print - {title}</h2>
			<button on:click={onClose} class="text-[#b5bac1] hover:text-white transition-colors" aria-label="Close">
				<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
					<path d="M15.8 4.2a.6.6 0 00-.85 0L10 9.15 5.05 4.2a.6.6 0 10-.85.85L9.15 10 4.2 14.95a.6.6 0 10.85.85L10 10.85l4.95 4.95a.6.6 0 10.85-.85L10.85 10l4.95-4.95a.6.6 0 000-.85z"/>
				</svg>
			</button>
		</div>

		<div class="flex border-b border-[#3f4147]">
			<button
				class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'preview' ? 'text-white border-b-2 border-[#5865f2]' : 'text-[#b5bac1] hover:text-white'}"
				on:click={() => (activeTab = 'preview')}
			>
				Preview
			</button>
			<button
				class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'settings' ? 'text-white border-b-2 border-[#5865f2]' : 'text-[#b5bac1] hover:text-white'}"
				on:click={() => (activeTab = 'settings')}
			>
				Settings
			</button>
		</div>

		<div class="flex-1 overflow-y-auto p-6">
			{#if activeTab === 'preview'}
				<div class="bg-white rounded-lg shadow-inner min-h-[400px] p-4 relative">
					{#if isGenerating}
						<div class="absolute inset-0 flex items-center justify-center bg-white/80">
							<div class="text-gray-500">Generating preview...</div>
						</div>
					{/if}
					{#if previewHtml}
						<iframe
							srcdoc={previewHtml}
							class="w-full min-h-[400px] border-0"
							title="Print preview"
						/>
					{:else}
						<div class="flex items-center justify-center h-[400px] text-gray-400">
							No content to preview
						</div>
					{/if}
				</div>
				<div class="mt-2 text-sm text-[#b5bac1]">
					Estimated pages: {estimatedPages}
				</div>
			{:else if settings}
				<div class="space-y-6">
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="block text-sm font-medium text-[#b5bac1] mb-1">Paper Size</label>
							<select
								bind:value={settings.paper_size}
								on:change={handleSettingChange}
								class="w-full bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 text-sm border border-[#3f4147]"
							>
								{#each paperSizes as size}
									<option value={size}>{size}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="block text-sm font-medium text-[#b5bac1] mb-1">Orientation</label>
							<select
								bind:value={settings.orientation}
								on:change={handleSettingChange}
								class="w-full bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 text-sm border border-[#3f4147]"
							>
								{#each orientations as o}
									<option value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
								{/each}
							</select>
						</div>
					</div>

					<div>
						<label class="block text-sm font-medium text-[#b5bac1] mb-1">Theme</label>
						<div class="flex gap-2">
							{#each themes as t}
								<button
									class="px-3 py-1.5 rounded text-sm {settings.theme === t.value ? 'bg-[#5865f2] text-white' : 'bg-[#1e1f22] text-[#b5bac1] hover:bg-[#2b2d31]'}"
									on:click={() => { settings.theme = t.value; handleSettingChange(); }}
								>
									{t.label}
								</button>
							{/each}
						</div>
					</div>

					<div>
						<label class="block text-sm font-medium text-[#b5bac1] mb-1">Font Size: {settings.font_size}pt</label>
						<input
							type="range"
							min="8"
							max="18"
							bind:value={settings.font_size}
							on:change={handleSettingChange}
							class="w-full"
						/>
					</div>

					<div class="space-y-2">
						<label class="flex items-center gap-2 text-sm text-[#dbdee1] cursor-pointer">
							<input type="checkbox" bind:checked={settings.include_avatars} on:change={handleSettingChange} class="rounded" />
							Include avatars
						</label>
						<label class="flex items-center gap-2 text-sm text-[#dbdee1] cursor-pointer">
							<input type="checkbox" bind:checked={settings.include_timestamps} on:change={handleSettingChange} class="rounded" />
							Include timestamps
						</label>
						<label class="flex items-center gap-2 text-sm text-[#dbdee1] cursor-pointer">
							<input type="checkbox" bind:checked={settings.include_reactions} on:change={handleSettingChange} class="rounded" />
							Include reactions
						</label>
					</div>

					<div>
						<label class="block text-sm font-medium text-[#b5bac1] mb-1">Header Text</label>
						<input
							type="text"
							bind:value={settings.header_text}
							on:change={handleSettingChange}
							placeholder="Optional header..."
							class="w-full bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 text-sm border border-[#3f4147]"
						/>
					</div>

					<div>
						<label class="block text-sm font-medium text-[#b5bac1] mb-1">Footer Text</label>
						<input
							type="text"
							bind:value={settings.footer_text}
							on:change={handleSettingChange}
							placeholder="Optional footer..."
							class="w-full bg-[#1e1f22] text-[#dbdee1] rounded px-3 py-2 text-sm border border-[#3f4147]"
						/>
					</div>
				</div>
			{/if}
		</div>

		<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#3f4147]">
			<button
				on:click={onClose}
				class="px-4 py-2 text-sm text-[#dbdee1] hover:text-white transition-colors"
			>
				Cancel
			</button>
			<button
				on:click={handleExportPdf}
				class="px-4 py-2 text-sm bg-[#4e5058] text-white rounded hover:bg-[#6d6f78] transition-colors"
			>
				Export HTML
			</button>
			<button
				on:click={handlePrint}
				class="px-4 py-2 text-sm bg-[#5865f2] text-white rounded hover:bg-[#4752c4] transition-colors"
			>
				Print
			</button>
		</div>
	</div>
</div>
