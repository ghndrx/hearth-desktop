<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import {
		stickerPacks,
		selectedPackId,
		selectedPack,
		stickerPacksLoading,
		loadStickerPacks,
		addStickerPack,
		addSticker,
		removeSticker,
		removeStickerPack
	} from '$lib/stores/stickers';
	import type { Sticker } from '$lib/api/stickers';

	export let show = false;

	const dispatch = createEventDispatcher<{ select: Sticker; close: void }>();

	let searchQuery = '';
	let showCreatePack = false;
	let newPackName = '';
	let newPackDescription = '';
	let uploading = false;
	let fileInput: HTMLInputElement;

	onMount(() => {
		loadStickerPacks();
	});

	$: filteredStickers = ($selectedPack?.stickers ?? []).filter(s =>
		!searchQuery || s.alias.toLowerCase().includes(searchQuery.toLowerCase())
	);

	function handleStickerClick(sticker: Sticker) {
		dispatch('select', sticker);
		dispatch('close');
	}

	async function handleCreatePack() {
		if (!newPackName.trim()) return;
		await addStickerPack(newPackName.trim(), newPackDescription.trim());
		newPackName = '';
		newPackDescription = '';
		showCreatePack = false;
	}

	async function handleDeletePack(packId: string) {
		if (confirm('Delete this sticker pack and all its stickers?')) {
			await removeStickerPack(packId);
		}
	}

	async function handleDeleteSticker(sticker: Sticker) {
		if (confirm(`Delete sticker "${sticker.alias}"?`)) {
			await removeSticker(sticker.pack_id, sticker.id);
		}
	}

	function triggerUpload() {
		fileInput?.click();
	}

	async function handleFileUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !$selectedPack) return;

		const validTypes = ['image/png', 'image/webp', 'image/gif'];
		if (!validTypes.includes(file.type)) {
			alert('Only PNG, WebP, and GIF files are supported.');
			return;
		}

		const alias = file.name.replace(/\.(png|webp|gif)$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
		uploading = true;
		await addSticker($selectedPack.id, file, alias);
		uploading = false;
		input.value = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			dispatch('close');
		}
	}
</script>

{#if show}
	<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
	<div
		class="sticker-picker"
		role="dialog"
		aria-label="Sticker picker"
		on:keydown={handleKeydown}
	>
		<!-- Search -->
		<div class="p-2 border-b border-[#3f4147]">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search stickers..."
				class="w-full px-3 py-1.5 bg-[#1e1f22] text-[#f2f3f5] text-sm rounded border-0 focus:outline-none placeholder:text-[#949ba4]"
			/>
		</div>

		<div class="flex h-[280px]">
			<!-- Pack tabs (sidebar) -->
			<div class="w-14 border-r border-[#3f4147] overflow-y-auto flex flex-col items-center gap-1 py-2">
				{#each $stickerPacks as pack}
					<button
						class="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium transition-colors"
						class:bg-[#5865f2]={$selectedPackId === pack.id}
						class:text-white={$selectedPackId === pack.id}
						class:bg-[#2b2d31]={$selectedPackId !== pack.id}
						class:text-[#949ba4]={$selectedPackId !== pack.id}
						class:hover:bg-[#383a40]={$selectedPackId !== pack.id}
						title={pack.name}
						on:click={() => selectedPackId.set(pack.id)}
						type="button"
					>
						{pack.name.slice(0, 2).toUpperCase()}
					</button>
				{/each}
				<button
					class="w-10 h-10 rounded-lg flex items-center justify-center text-[#949ba4] bg-[#2b2d31] hover:bg-[#383a40] hover:text-[#f2f3f5] transition-colors"
					title="Create new pack"
					on:click={() => (showCreatePack = !showCreatePack)}
					type="button"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
				</button>
			</div>

			<!-- Sticker grid -->
			<div class="flex-1 overflow-y-auto p-2">
				{#if showCreatePack}
					<div class="p-2 space-y-2">
						<h3 class="text-sm font-semibold text-[#f2f3f5]">New Sticker Pack</h3>
						<input
							type="text"
							bind:value={newPackName}
							placeholder="Pack name"
							class="w-full px-3 py-1.5 bg-[#1e1f22] text-[#f2f3f5] text-sm rounded border-0 focus:outline-none placeholder:text-[#949ba4]"
						/>
						<input
							type="text"
							bind:value={newPackDescription}
							placeholder="Description (optional)"
							class="w-full px-3 py-1.5 bg-[#1e1f22] text-[#f2f3f5] text-sm rounded border-0 focus:outline-none placeholder:text-[#949ba4]"
						/>
						<div class="flex gap-2">
							<button
								class="px-3 py-1 bg-[#5865f2] text-white text-sm rounded hover:bg-[#4752c4] transition-colors"
								on:click={handleCreatePack}
								disabled={!newPackName.trim()}
								type="button"
							>
								Create
							</button>
							<button
								class="px-3 py-1 bg-[#2b2d31] text-[#949ba4] text-sm rounded hover:bg-[#383a40] transition-colors"
								on:click={() => (showCreatePack = false)}
								type="button"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else if $stickerPacksLoading}
					<div class="flex items-center justify-center h-full text-[#949ba4] text-sm">
						Loading stickers...
					</div>
				{:else if $stickerPacks.length === 0}
					<div class="flex flex-col items-center justify-center h-full text-[#949ba4] text-sm gap-2">
						<p>No sticker packs yet</p>
						<button
							class="px-3 py-1 bg-[#5865f2] text-white text-sm rounded hover:bg-[#4752c4] transition-colors"
							on:click={() => (showCreatePack = true)}
							type="button"
						>
							Create a pack
						</button>
					</div>
				{:else if $selectedPack}
					<!-- Pack header -->
					<div class="flex items-center justify-between mb-2 px-1">
						<h3 class="text-sm font-semibold text-[#f2f3f5] truncate">{$selectedPack.name}</h3>
						<div class="flex gap-1">
							<button
								class="p-1 text-[#949ba4] hover:text-[#f2f3f5] transition-colors"
								title="Upload sticker"
								on:click={triggerUpload}
								disabled={uploading}
								type="button"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
									<polyline points="17 8 12 3 7 8" />
									<line x1="12" y1="3" x2="12" y2="15" />
								</svg>
							</button>
							<button
								class="p-1 text-[#949ba4] hover:text-[#f23f43] transition-colors"
								title="Delete pack"
								on:click={() => handleDeletePack($selectedPack.id)}
								type="button"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
									<polyline points="3 6 5 6 21 6" />
									<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
								</svg>
							</button>
						</div>
					</div>

					<!-- Stickers grid -->
					{#if filteredStickers.length === 0}
						<div class="flex flex-col items-center justify-center h-48 text-[#949ba4] text-sm gap-2">
							{#if searchQuery}
								<p>No stickers match "{searchQuery}"</p>
							{:else}
								<p>This pack is empty</p>
								<button
									class="px-3 py-1 bg-[#5865f2] text-white text-sm rounded hover:bg-[#4752c4] transition-colors"
									on:click={triggerUpload}
									type="button"
								>
									Upload a sticker
								</button>
							{/if}
						</div>
					{:else}
						<div class="grid grid-cols-3 gap-1">
							{#each filteredStickers as sticker}
								<div class="relative group">
									<button
										class="w-full aspect-square rounded-lg bg-[#2b2d31] hover:bg-[#383a40] transition-colors flex items-center justify-center p-2"
										title={sticker.alias}
										on:click={() => handleStickerClick(sticker)}
										type="button"
									>
										<img
											src={sticker.image_url}
											alt={sticker.alias}
											class="w-full h-full object-contain"
											loading="lazy"
										/>
									</button>
									<button
										class="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-[#2b2d31] text-[#949ba4] hover:text-[#f23f43] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
										title="Delete sticker"
										on:click|stopPropagation={() => handleDeleteSticker(sticker)}
										type="button"
									>
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
											<line x1="18" y1="6" x2="6" y2="18" />
											<line x1="6" y1="6" x2="18" y2="18" />
										</svg>
									</button>
								</div>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Hidden file input -->
		<input
			bind:this={fileInput}
			type="file"
			accept="image/png,image/webp,image/gif"
			class="hidden"
			on:change={handleFileUpload}
		/>
	</div>
{/if}

<style>
	.sticker-picker {
		position: absolute;
		bottom: 100%;
		right: 0;
		width: 360px;
		background-color: #2b2d31;
		border-radius: 8px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
		z-index: 100;
		margin-bottom: 8px;
		overflow: hidden;
	}
</style>
