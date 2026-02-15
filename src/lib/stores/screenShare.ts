import { writable, derived, get } from 'svelte/store';
import { voiceCall } from './voiceCall';

/**
 * Screen share source type
 */
export type ScreenShareSourceType = 'screen' | 'window';

/**
 * Screen share source (display or window)
 */
export interface ScreenShareSource {
	id: string;
	name: string;
	type: ScreenShareSourceType;
	thumbnail?: string;
}

/**
 * Screen share state
 */
export interface ScreenShareState {
	isModalOpen: boolean;
	isSharing: boolean;
	isPreviewing: boolean;
	stream: MediaStream | null;
	selectedSource: ScreenShareSource | null;
	availableSources: ScreenShareSource[];
	error: string | null;
}

const initialState: ScreenShareState = {
	isModalOpen: false,
	isSharing: false,
	isPreviewing: false,
	stream: null,
	selectedSource: null,
	availableSources: [],
	error: null
};

function createScreenShareStore() {
	const { subscribe, set, update } = writable<ScreenShareState>(initialState);

	/**
	 * Stop all tracks in the current stream
	 */
	function stopStream() {
		const state = get({ subscribe });
		if (state.stream) {
			state.stream.getTracks().forEach(track => {
				track.stop();
			});
		}
	}

	return {
		subscribe,

		/**
		 * Open the screen share selection modal
		 */
		openModal: () => {
			update(state => ({
				...state,
				isModalOpen: true,
				error: null
			}));
		},

		/**
		 * Close the screen share selection modal
		 */
		closeModal: () => {
			update(state => {
				// Stop preview stream if any
				if (state.isPreviewing && state.stream) {
					state.stream.getTracks().forEach(track => track.stop());
				}
				return {
					...state,
					isModalOpen: false,
					isPreviewing: false,
					stream: state.isSharing ? state.stream : null,
					error: null
				};
			});
		},

		/**
		 * Request screen/window capture using browser API
		 */
		requestCapture: async (sourceType: ScreenShareSourceType = 'screen') => {
			try {
				// Use the standard getDisplayMedia API
				// This will show the browser's native picker
				const constraints: DisplayMediaStreamOptions = {
					video: {
						// @ts-ignore - cursor is valid but not in all TypeScript defs
						cursor: 'always',
						displaySurface: sourceType === 'screen' ? 'monitor' : 'window'
					},
					audio: {
						// Capture system audio if available
						suppressLocalAudioPlayback: false
					} as MediaTrackConstraints
				};

				const stream = await navigator.mediaDevices.getDisplayMedia(constraints);

				// Listen for when the user stops sharing via browser UI
				stream.getVideoTracks()[0].addEventListener('ended', () => {
					const currentState = get({ subscribe });
					if (currentState.isSharing) {
						// User clicked "Stop sharing" in browser UI
						update(state => ({
							...state,
							isSharing: false,
							isPreviewing: false,
							stream: null,
							selectedSource: null
						}));
						// Update voice call state
						voiceCall.toggleScreenShare();
					}
				});

				// Get track settings to determine what was selected
				const videoTrack = stream.getVideoTracks()[0];
				const settings = videoTrack.getSettings();
				
				const source: ScreenShareSource = {
					id: videoTrack.id,
					name: videoTrack.label || 'Screen',
					type: (settings as any).displaySurface === 'monitor' ? 'screen' : 'window'
				};

				update(state => ({
					...state,
					stream,
					selectedSource: source,
					isPreviewing: true,
					error: null
				}));

				return stream;
			} catch (err) {
				const error = err instanceof Error ? err.message : 'Failed to capture screen';
				
				// Don't show error if user cancelled
				if (error.includes('Permission denied') || error.includes('cancelled')) {
					update(state => ({
						...state,
						error: null
					}));
					return null;
				}

				update(state => ({
					...state,
					error
				}));
				return null;
			}
		},

		/**
		 * Start sharing the current preview stream
		 */
		startSharing: () => {
			update(state => {
				if (!state.stream) {
					return { ...state, error: 'No stream to share' };
				}
				return {
					...state,
					isSharing: true,
					isModalOpen: false,
					error: null
				};
			});

			// Update voice call state if not already sharing
			const vcState = get(voiceCall);
			if (!vcState.screenSharing) {
				voiceCall.toggleScreenShare();
			}
		},

		/**
		 * Stop sharing and clean up
		 */
		stopSharing: () => {
			stopStream();
			
			update(state => ({
				...state,
				isSharing: false,
				isPreviewing: false,
				stream: null,
				selectedSource: null,
				error: null
			}));

			// Update voice call state if currently sharing
			const vcState = get(voiceCall);
			if (vcState.screenSharing) {
				voiceCall.toggleScreenShare();
			}
		},

		/**
		 * Cancel preview without starting share
		 */
		cancelPreview: () => {
			stopStream();
			
			update(state => ({
				...state,
				isPreviewing: false,
				stream: null,
				selectedSource: null,
				error: null
			}));
		},

		/**
		 * Get the current stream
		 */
		getStream: () => {
			return get({ subscribe }).stream;
		},

		/**
		 * Reset to initial state
		 */
		reset: () => {
			stopStream();
			set(initialState);
		}
	};
}

export const screenShare = createScreenShareStore();

// Derived stores for convenience
export const isScreenShareModalOpen = derived(screenShare, $ss => $ss.isModalOpen);
export const isScreenSharing = derived(screenShare, $ss => $ss.isSharing);
export const isPreviewing = derived(screenShare, $ss => $ss.isPreviewing);
export const screenShareStream = derived(screenShare, $ss => $ss.stream);
export const screenShareError = derived(screenShare, $ss => $ss.error);
export const selectedScreenSource = derived(screenShare, $ss => $ss.selectedSource);
