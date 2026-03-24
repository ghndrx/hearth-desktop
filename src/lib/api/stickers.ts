import { api } from '$lib/api';

export interface Sticker {
	id: string;
	pack_id: string;
	alias: string;
	image_url: string;
	format: 'png' | 'webp' | 'gif';
	created_at: string;
}

export interface StickerPack {
	id: string;
	name: string;
	description: string;
	stickers: Sticker[];
	created_at: string;
	updated_at: string;
}

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
