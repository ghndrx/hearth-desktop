// Transcription types for voice channel real-time transcription

export interface TranscriptSegment {
	id: string;
	userId: string;
	username: string;
	text: string;
	timestamp: number;
	startTime: number;
	endTime: number;
	confidence: number;
	language: string;
	isFinal: boolean;
	speakerColor?: string;
}

export interface TranscriptionConfig {
	model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
	language: 'auto' | string;
	showTimestamps: boolean;
	showConfidence: boolean;
	showSpeakerLabels: boolean;
}

export interface LiveCaptionEntry {
	id: string;
	userId: string;
	username: string;
	text: string;
	timestamp: number;
	confidence: number;
	language: string;
	isFinal: boolean;
	speakerColor: string;
}

// Speaker color palette for distinguishing multiple speakers
export const SPEAKER_COLORS = [
	'#ef4444', // red
	'#f97316', // orange
	'#eab308', // yellow
	'#22c55e', // green
	'#06b6d4', // cyan
	'#3b82f6', // blue
	'#8b5cf6', // violet
	'#ec4899', // pink
	'#14b8a6', // teal
	'#f59e0b', // amber
];

export function getSpeakerColor(index: number): string {
	return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}
