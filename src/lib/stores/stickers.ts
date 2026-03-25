import { writable, derived } from 'svelte/store';
import {
	getStickerPacks,
	createStickerPack,
	deleteStickerPack,
	uploadSticker,
	deleteSticker,
	type StickerPack,
	type Sticker
} from '$lib/api/stickers';

export type { StickerPack, Sticker };

export const stickerPacks = writable<StickerPack[]>([]);
export const stickerPickerOpen = writable(false);
export const selectedPackId = writable<string | null>(null);
export const stickerPacksLoading = writable(false);

export const selectedPack = derived(
	[stickerPacks, selectedPackId],
	([$packs, $id]) => $packs.find(p => p.id === $id) ?? $packs[0] ?? null
);

export async function loadStickerPacks(): Promise<void> {
	stickerPacksLoading.set(true);
	try {
		const packs = await getStickerPacks();
		stickerPacks.set(packs);
		// Auto-select first pack if none selected
		if (packs.length > 0) {
			selectedPackId.update(current => current ?? packs[0].id);
		}
	} catch (err) {
		console.error('Failed to load sticker packs:', err);
	} finally {
		stickerPacksLoading.set(false);
	}
}

export async function addStickerPack(name: string, description?: string): Promise<StickerPack | null> {
	try {
		const pack = await createStickerPack(name, description);
		stickerPacks.update(packs => [...packs, pack]);
		selectedPackId.set(pack.id);
		return pack;
	} catch (err) {
		console.error('Failed to create sticker pack:', err);
		return null;
	}
}

export async function removeStickerPack(packId: string): Promise<boolean> {
	try {
		await deleteStickerPack(packId);
		stickerPacks.update(packs => packs.filter(p => p.id !== packId));
		selectedPackId.update(current => current === packId ? null : current);
		return true;
	} catch (err) {
		console.error('Failed to delete sticker pack:', err);
		return false;
	}
}

export async function addSticker(packId: string, file: File, alias: string): Promise<Sticker | null> {
	try {
		const sticker = await uploadSticker(packId, file, alias);
		stickerPacks.update(packs =>
			packs.map(p =>
				p.id === packId
					? { ...p, stickers: [...p.stickers, sticker] }
					: p
			)
		);
		return sticker;
	} catch (err) {
		console.error('Failed to upload sticker:', err);
		return null;
	}
}

export async function removeSticker(packId: string, stickerId: string): Promise<boolean> {
	try {
		await deleteSticker(packId, stickerId);
		stickerPacks.update(packs =>
			packs.map(p =>
				p.id === packId
					? { ...p, stickers: p.stickers.filter(s => s.id !== stickerId) }
					: p
			)
		);
		return true;
	} catch (err) {
		console.error('Failed to delete sticker:', err);
		return false;
	}
}

export function toggleStickerPicker(): void {
	stickerPickerOpen.update(v => !v);
}

export function closeStickerPicker(): void {
	stickerPickerOpen.set(false);
}
