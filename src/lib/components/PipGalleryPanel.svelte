<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	interface PipWindow {
		id: string;
		title: string;
		x: number;
		y: number;
		width: number;
		height: number;
		opacity: number;
		alwaysOnTop: boolean;
		visible: boolean;
		sourceType: 'channel' | 'voice' | 'media';
	}

	let windows = $state<PipWindow[]>([]);
	let error = $state<string | null>(null);
	let newTitle = $state('');
	let newSourceType = $state<'channel' | 'voice' | 'media'>('media');
	let showCreateForm = $state(false);

	$effect(() => {
		loadWindows();
	});

	async function loadWindows() {
		try {
			windows = await invoke<PipWindow[]>('gallery_get_windows');
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function createWindow() {
		if (!newTitle.trim()) {
			error = 'Title is required';
			return;
		}
		try {
			await invoke('gallery_create_window', {
				title: newTitle.trim(),
				sourceType: newSourceType
			});
			newTitle = '';
			showCreateForm = false;
			await loadWindows();
		} catch (e) {
			error = String(e);
		}
	}

	async function closeWindow(id: string) {
		try {
			await invoke('gallery_close_window', { id });
			await loadWindows();
		} catch (e) {
			error = String(e);
		}
	}

	async function setOpacity(id: string, opacity: number) {
		try {
			await invoke('gallery_set_opacity', { id, opacity });
			await loadWindows();
		} catch (e) {
			error = String(e);
		}
	}

	async function toggleAlwaysOnTop(id: string) {
		try {
			await invoke('gallery_toggle_always_on_top', { id });
			await loadWindows();
		} catch (e) {
			error = String(e);
		}
	}

	async function arrangeGrid() {
		try {
			windows = await invoke<PipWindow[]>('gallery_arrange_grid', {});
			error = null;
		} catch (e) {
			error = String(e);
		}
	}

	async function closeAll() {
		try {
			await invoke('gallery_close_all');
			await loadWindows();
		} catch (e) {
			error = String(e);
		}
	}

	function sourceLabel(type: string): string {
		switch (type) {
			case 'channel': return 'Channel';
			case 'voice': return 'Voice';
			case 'media': return 'Media';
			default: return type;
		}
	}

	function sourceIcon(type: string): string {
		switch (type) {
			case 'channel': return '#';
			case 'voice': return '\u{1F50A}';
			case 'media': return '\u{25B6}';
			default: return '?';
		}
	}
</script>

<div class="flex flex-col gap-3 p-4 bg-[#2b2d31] rounded-lg text-[#dbdee1] font-sans">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-2">
			<svg class="w-5 h-5 text-[#5865f2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<rect x="2" y="3" width="20" height="14" rx="2" />
				<rect x="12" y="9" width="9" height="7" rx="1" />
			</svg>
			<h3 class="m-0 text-sm font-semibold">PiP Gallery</h3>
			{#if windows.length > 0}
				<span class="bg-[#5865f2] text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full">
					{windows.length}
				</span>
			{/if}
		</div>
		<div class="flex items-center gap-1">
			{#if windows.length > 1}
				<button
					class="p-1 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#1e1f22] border-none bg-transparent cursor-pointer"
					title="Arrange grid"
					onclick={arrangeGrid}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<rect x="3" y="3" width="7" height="7" />
						<rect x="14" y="3" width="7" height="7" />
						<rect x="3" y="14" width="7" height="7" />
						<rect x="14" y="14" width="7" height="7" />
					</svg>
				</button>
			{/if}
			{#if windows.length > 0}
				<button
					class="p-1 rounded text-[#949ba4] hover:text-[#ed4245] hover:bg-[#1e1f22] border-none bg-transparent cursor-pointer"
					title="Close all"
					onclick={closeAll}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			{/if}
			<button
				class="p-1 rounded border-none cursor-pointer {showCreateForm ? 'text-[#5865f2] bg-[#5865f2]/15' : 'text-[#949ba4] hover:text-[#dbdee1] bg-transparent hover:bg-[#1e1f22]'}"
				title="New PiP window"
				onclick={() => (showCreateForm = !showCreateForm)}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<line x1="12" y1="5" x2="12" y2="19" />
					<line x1="5" y1="12" x2="19" y2="12" />
				</svg>
			</button>
		</div>
	</div>

	<!-- Error -->
	{#if error}
		<div class="px-2 py-1.5 bg-[#ed4245]/15 border border-[#ed4245] rounded text-xs text-[#ed4245]">
			{error}
		</div>
	{/if}

	<!-- Create form -->
	{#if showCreateForm}
		<div class="flex flex-col gap-2 p-3 bg-[#1e1f22] rounded-lg">
			<input
				type="text"
				bind:value={newTitle}
				placeholder="Window title"
				class="w-full px-2.5 py-2 rounded border border-[#3f4147] bg-[#383a40] text-[#dbdee1] text-sm box-border focus:outline-none focus:border-[#5865f2]"
			/>
			<div class="flex gap-1">
				{#each ['channel', 'voice', 'media'] as type}
					<button
						class="flex-1 py-1.5 rounded border text-xs cursor-pointer {newSourceType === type
							? 'border-[#5865f2] text-[#dbdee1] bg-[#5865f2]/15'
							: 'border-[#3f4147] text-[#949ba4] bg-[#383a40] hover:text-[#dbdee1]'}"
						onclick={() => (newSourceType = type as 'channel' | 'voice' | 'media')}
					>
						{sourceLabel(type)}
					</button>
				{/each}
			</div>
			<button
				class="w-full py-2 rounded border-none bg-[#5865f2] text-white text-sm font-medium cursor-pointer hover:bg-[#4752c4]"
				onclick={createWindow}
			>
				Create PiP Window
			</button>
		</div>
	{/if}

	<!-- Window cards -->
	{#if windows.length === 0}
		<div class="flex flex-col items-center gap-2 py-6 text-[#949ba4]">
			<svg class="w-10 h-10 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<rect x="2" y="3" width="20" height="14" rx="2" />
				<rect x="12" y="9" width="9" height="7" rx="1" />
			</svg>
			<span class="text-xs">No PiP windows open</span>
			<button
				class="mt-1 px-3 py-1.5 rounded border-none bg-[#5865f2] text-white text-xs cursor-pointer hover:bg-[#4752c4]"
				onclick={() => (showCreateForm = true)}
			>
				Create one
			</button>
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each windows as win (win.id)}
				<div class="flex flex-col gap-2 p-3 bg-[#1e1f22] rounded-lg" style="opacity: {win.opacity}">
					<!-- Window header row -->
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2 min-w-0">
							<span class="text-xs w-5 h-5 flex items-center justify-center rounded bg-[#383a40] shrink-0">
								{sourceIcon(win.sourceType)}
							</span>
							<span class="text-sm font-medium truncate">{win.title}</span>
						</div>
						<div class="flex items-center gap-1 shrink-0">
							<button
								class="p-1 rounded border-none bg-transparent cursor-pointer {win.alwaysOnTop
									? 'text-[#5865f2]'
									: 'text-[#949ba4] hover:text-[#dbdee1]'}"
								title="{win.alwaysOnTop ? 'Unpin from top' : 'Pin on top'}"
								onclick={() => toggleAlwaysOnTop(win.id)}
							>
								<svg viewBox="0 0 24 24" fill="{win.alwaysOnTop ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" width="14" height="14">
									<path d="M12 2L15 9H21L16 14L18 21L12 17L6 21L8 14L3 9H9L12 2Z" />
								</svg>
							</button>
							<button
								class="p-1 rounded border-none bg-transparent text-[#949ba4] hover:text-[#ed4245] cursor-pointer"
								title="Close"
								onclick={() => closeWindow(win.id)}
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							</button>
						</div>
					</div>

					<!-- Info row -->
					<div class="flex items-center justify-between text-[11px] text-[#949ba4]">
						<span>{sourceLabel(win.sourceType)}</span>
						<span>{Math.round(win.width)}x{Math.round(win.height)}</span>
						<span>({Math.round(win.x)}, {Math.round(win.y)})</span>
					</div>

					<!-- Opacity slider -->
					<div class="flex items-center gap-2">
						<span class="text-[11px] text-[#949ba4] w-12 shrink-0">Opacity</span>
						<input
							type="range"
							min="0.1"
							max="1"
							step="0.05"
							value={win.opacity}
							class="flex-1 accent-[#5865f2] h-1"
							oninput={(e) => setOpacity(win.id, parseFloat((e.target as HTMLInputElement).value))}
						/>
						<span class="text-[11px] text-[#949ba4] w-8 text-right">{Math.round(win.opacity * 100)}%</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
