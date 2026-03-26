import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { TranscriptSegment } from '$lib/transcription';

export interface TranscriptionStoreState {
	/** Whether transcription is enabled (user toggled on) */
	enabled: boolean;
	/** Whether the service is currently active and transcribing */
	isActive: boolean;
	/** Whether the model is initialized and ready */
	isInitialized: boolean;
	/** Whether a model is currently loading */
	isModelLoading: boolean;
	/** Whether a model is being downloaded */
	isDownloading: boolean;
	/** Download progress percentage */
	downloadProgress: number;
	/** Selected language code */
	language: string;
	/** Selected model name */
	model: string;
	/** Transcript segments */
	segments: TranscriptSegment[];
	/** Whether the transcript panel is visible */
	panelOpen: boolean;
	/** Error message if any */
	error: string | null;
}

const initialState: TranscriptionStoreState = {
	enabled: false,
	isActive: false,
	isInitialized: false,
	isModelLoading: false,
	isDownloading: false,
	downloadProgress: 0,
	language: 'auto',
	model: 'base',
	segments: [],
	panelOpen: false,
	error: null,
};

function createTranscriptionStore() {
	const { subscribe, set, update } = writable<TranscriptionStoreState>(initialState);

	return {
		subscribe,
		set,
		update,

		togglePanel() {
			update(s => ({ ...s, panelOpen: !s.panelOpen }));
		},

		openPanel() {
			update(s => ({ ...s, panelOpen: true }));
		},

		closePanel() {
			update(s => ({ ...s, panelOpen: false }));
		},

		setEnabled(enabled: boolean) {
			update(s => ({ ...s, enabled }));
		},

		setActive(isActive: boolean) {
			update(s => ({ ...s, isActive }));
		},

		setInitialized(isInitialized: boolean) {
			update(s => ({ ...s, isInitialized }));
		},

		setModelLoading(isModelLoading: boolean) {
			update(s => ({ ...s, isModelLoading }));
		},

		setDownloading(isDownloading: boolean, progress = 0) {
			update(s => ({ ...s, isDownloading, downloadProgress: progress }));
		},

		setLanguage(language: string) {
			update(s => ({ ...s, language }));
		},

		setModel(model: string) {
			update(s => ({ ...s, model }));
		},

		addSegment(segment: TranscriptSegment) {
			update(s => {
				const segments = [...s.segments, segment];
				// Keep max 500 segments
				if (segments.length > 500) {
					return { ...s, segments: segments.slice(-500) };
				}
				return { ...s, segments };
			});
		},

		clearSegments() {
			update(s => ({ ...s, segments: [] }));
		},

		setError(error: string | null) {
			update(s => ({ ...s, error }));
		},

		reset() {
			set(initialState);
		},
	};
}

export const transcriptionStore = createTranscriptionStore();

// Derived convenience stores
export const isTranscriptionPanelOpen = derived(transcriptionStore, $s => $s.panelOpen);
export const isTranscriptionActive = derived(transcriptionStore, $s => $s.isActive);
export const transcriptionSegments = derived(transcriptionStore, $s => $s.segments);

// Persist panel and language preferences
if (browser) {
	const saved = localStorage.getItem('hearth_transcription_prefs');
	if (saved) {
		try {
			const prefs = JSON.parse(saved);
			transcriptionStore.update(s => ({
				...s,
				language: prefs.language || 'auto',
				model: prefs.model || 'base',
			}));
		} catch {
			// Ignore parse errors
		}
	}

	transcriptionStore.subscribe(state => {
		localStorage.setItem('hearth_transcription_prefs', JSON.stringify({
			language: state.language,
			model: state.model,
		}));
	});
}
