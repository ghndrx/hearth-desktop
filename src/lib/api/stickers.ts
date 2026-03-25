import { api } from '$lib/api';
import type { Sticker, StickerPack } from '$lib/types/sticker';

export type { Sticker, StickerPack };

export async function getStickerPacks(): Promise<StickerPack[]> {
	return api.get<StickerPack[]>('/sticker-packs');
}

export async function createStickerPack(name: string, description?: string): Promise<StickerPack> {
	return api.post<StickerPack>('/sticker-packs', { name, description: description || '' });
}

export async function deleteStickerPack(packId: string): Promise<void> {
	return api.delete<void>(`/sticker-packs/${packId}`);
}

export async function uploadSticker(packId: string, file: File, alias: string): Promise<Sticker> {
	const formData = new FormData();
	formData.append('file', file);
	formData.append('alias', alias);
	return api.upload<Sticker>(`/sticker-packs/${packId}/stickers`, formData);
}

export async function deleteSticker(packId: string, stickerId: string): Promise<void> {
	return api.delete<void>(`/sticker-packs/${packId}/stickers/${stickerId}`);
}
