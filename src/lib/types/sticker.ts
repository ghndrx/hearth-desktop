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
