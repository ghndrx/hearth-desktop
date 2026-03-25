<script lang="ts">
	import { onMount } from 'svelte';
	import {
		stickerPacks,
		stickerPacksLoading,
		loadStickerPacks,
		addStickerPack,
		removeStickerPack,
		addSticker,
		removeSticker
	} from '$lib/stores/stickers';
	import type { Sticker } from '$lib/api/stickers';

	let newPackName = '';
	let newPackDescription = '';
	let creating = false;
	let expandedPackId: string | null = null;
	let fileInputs: Record<string, HTMLInputElement> = {};

	onMount(() => {
		loadStickerPacks();
	});

	async function handleCreatePack() {
		if (!newPackName.trim()) return;
		creating = true;
		await addStickerPack(newPackName.trim(), newPackDescription.trim());
		newPackName = '';
		newPackDescription = '';
		creating = false;
	}

	async function handleDeletePack(packId: string) {
		if (confirm('Delete this sticker pack and all its stickers? This cannot be undone.')) {
			await removeStickerPack(packId);
		}
	}

	async function handleDeleteSticker(sticker: Sticker) {
		if (confirm(`Delete sticker "${sticker.alias}"?`)) {
			await removeSticker(sticker.pack_id, sticker.id);
		}
	}

	function triggerUpload(packId: string) {
		fileInputs[packId]?.click();
	}

	async function handleFileUpload(packId: string, e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const validTypes = ['image/png', 'image/webp', 'image/gif'];
		if (!validTypes.includes(file.type)) {
			alert('Only PNG, WebP, and GIF files are supported.');
			return;
		}

		const alias = file.name.replace(/\.(png|webp|gif)$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
		await addSticker(packId, file, alias);
		input.value = '';
	}

	function togglePack(packId: string) {
		expandedPackId = expandedPackId === packId ? null : packId;
	}
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-xl font-semibold text-[#f2f3f5] mb-1">Stickers</h2>
		<p class="text-sm text-[#949ba4]">Manage your sticker packs and upload custom stickers.</p>
	</div>

	<!-- Create New Pack -->
	<div class="bg-[#1e1f22] rounded-lg p-4 space-y-3">
		<h3 class="text-sm font-semibold text-[#f2f3f5]">Create New Pack</h3>
		<input
			type="text"
			bind:value={newPackName}
			placeholder="Pack name"
			class="w-full px-3 py-2 bg-[#2b2d31] text-[#f2f3f5] text-sm rounded border border-[#3f4147] focus:outline-none focus:border-[#5865f2] placeholder:text-[#949ba4]"
		/>
		<input
			type="text"
			bind:value={newPackDescription}
			placeholder="Description (optional)"
			class="w-full px-3 py-2 bg-[#2b2d31] text-[#f2f3f5] text-sm rounded border border-[#3f4147] focus:outline-none focus:border-[#5865f2] placeholder:text-[#949ba4]"
		/>
		<button
			class="px-4 py-2 bg-[#5865f2] text-white text-sm font-medium rounded hover:bg-[#4752c4] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			on:click={handleCreatePack}
			disabled={!newPackName.trim() || creating}
			type="button"
		>
			{creating ? 'Creating...' : 'Create Pack'}
		</button>
	</div>

	<!-- Sticker Packs List -->
	{#if $stickerPacksLoading}
		<div class="text-[#949ba4] text-sm py-4 text-center">Loading sticker packs...</div>
	{:else if $stickerPacks.length === 0}
		<div class="text-[#949ba4] text-sm py-8 text-center">
			No sticker packs yet. Create one above to get started!
		</div>
	{:else}
		<div class="space-y-2">
			{#each $stickerPacks as pack}
				<div class="bg-[#1e1f22] rounded-lg overflow-hidden">
					<!-- Pack header -->
					<button
						class="w-full flex items-center justify-between p-4 hover:bg-[#2b2d31] transition-colors text-left"
						on:click={() => togglePack(pack.id)}
						type="button"
					>
						<div>
							<h3 class="text-sm font-semibold text-[#f2f3f5]">{pack.name}</h3>
							{#if pack.description}
								<p class="text-xs text-[#949ba4] mt-0.5">{pack.description}</p>
							{/if}
							<p class="text-xs text-[#949ba4] mt-0.5">{pack.stickers.length} sticker{pack.stickers.length !== 1 ? 's' : ''}</p>
						</div>
						<svg
							width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
							class="text-[#949ba4] transition-transform"
							class:rotate-180={expandedPackId === pack.id}
							aria-hidden="true"
						>
							<polyline points="6 9 12 15 18 9" />
						</svg>
					</button>

					<!-- Pack contents (expanded) -->
					{#if expandedPackId === pack.id}
						<div class="border-t border-[#3f4147] p-4 space-y-3">
							<!-- Actions -->
							<div class="flex gap-2">
								<button
									class="px-3 py-1.5 bg-[#5865f2] text-white text-sm rounded hover:bg-[#4752c4] transition-colors"
									on:click={() => triggerUpload(pack.id)}
									type="button"
								>
									Upload Sticker
								</button>
								<button
									class="px-3 py-1.5 bg-[#f23f43] text-white text-sm rounded hover:bg-[#da373c] transition-colors"
									on:click={() => handleDeletePack(pack.id)}
									type="button"
								>
									Delete Pack
								</button>
								<input
									bind:this={fileInputs[pack.id]}
									type="file"
									accept="image/png,image/webp,image/gif"
									class="hidden"
									on:change={(e) => handleFileUpload(pack.id, e)}
								/>
							</div>

							<!-- Stickers grid -->
							{#if pack.stickers.length === 0}
								<p class="text-sm text-[#949ba4] py-4 text-center">No stickers in this pack yet.</p>
							{:else}
								<div class="grid grid-cols-6 gap-2">
									{#each pack.stickers as sticker}
										<div class="relative group">
											<div class="aspect-square rounded-lg bg-[#2b2d31] flex items-center justify-center p-2">
												<img
													src={sticker.image_url}
													alt={sticker.alias}
													title={sticker.alias}
													class="w-full h-full object-contain"
													loading="lazy"
												/>
											</div>
											<button
												class="absolute top-0.5 right-0.5 w-5 h-5 rounded bg-[#f23f43] text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
												title="Delete {sticker.alias}"
												on:click={() => handleDeleteSticker(sticker)}
												type="button"
											>
												<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
													<line x1="18" y1="6" x2="6" y2="18" />
													<line x1="6" y1="6" x2="18" y2="18" />
												</svg>
											</button>
											<p class="text-xs text-[#949ba4] text-center mt-1 truncate">{sticker.alias}</p>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
