import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { voiceCall, isInVoiceCall } from './voiceCall';
import { settings, voiceSettings } from './settings';

export interface PushToTalkState {
	isKeyPressed: boolean;
	isRecording: boolean;
	isCapturingKey: boolean; // For keybind capture UI
	lastCapturedKey: string | null;
	lastCapturedKeyDisplay: string | null;
}

const initialState: PushToTalkState = {
	isKeyPressed: false,
	isRecording: false,
	isCapturingKey: false,
	lastCapturedKey: null,
	lastCapturedKeyDisplay: null
};

/**
 * Format a keyboard event into a human-readable key display string
 */
export function formatKeyDisplay(e: KeyboardEvent): string {
	const parts: string[] = [];
	
	if (e.ctrlKey && e.code !== 'ControlLeft' && e.code !== 'ControlRight') {
		parts.push('Ctrl');
	}
	if (e.shiftKey && e.code !== 'ShiftLeft' && e.code !== 'ShiftRight') {
		parts.push('Shift');
	}
	if (e.altKey && e.code !== 'AltLeft' && e.code !== 'AltRight') {
		parts.push('Alt');
	}
	if (e.metaKey && e.code !== 'MetaLeft' && e.code !== 'MetaRight') {
		parts.push('⌘');
	}
	
	// Map special keys to readable names
	const keyMap: Record<string, string> = {
		'Space': 'Space',
		'Backquote': '`',
		'Minus': '-',
		'Equal': '=',
		'BracketLeft': '[',
		'BracketRight': ']',
		'Backslash': '\\',
		'Semicolon': ';',
		'Quote': "'",
		'Comma': ',',
		'Period': '.',
		'Slash': '/',
		'ArrowUp': '↑',
		'ArrowDown': '↓',
		'ArrowLeft': '←',
		'ArrowRight': '→',
		'Enter': 'Enter',
		'Tab': 'Tab',
		'Escape': 'Esc',
		'Backspace': 'Backspace',
		'Delete': 'Delete',
		'Insert': 'Insert',
		'Home': 'Home',
		'End': 'End',
		'PageUp': 'PageUp',
		'PageDown': 'PageDown',
		'CapsLock': 'CapsLock',
		'NumLock': 'NumLock',
		'ScrollLock': 'ScrollLock',
		'Pause': 'Pause',
		'PrintScreen': 'PrintScreen',
		'ContextMenu': 'Menu'
	};
	
	let keyName = '';
	
	if (e.code.startsWith('Key')) {
		keyName = e.code.slice(3); // KeyA -> A
	} else if (e.code.startsWith('Digit')) {
		keyName = e.code.slice(5); // Digit1 -> 1
	} else if (e.code.startsWith('Numpad')) {
		keyName = 'Num' + e.code.slice(6); // Numpad1 -> Num1
	} else if (e.code.startsWith('F') && /^F\d+$/.test(e.code)) {
		keyName = e.code; // F1, F2, etc.
	} else if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
		keyName = 'Ctrl';
	} else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
		keyName = 'Shift';
	} else if (e.code === 'AltLeft' || e.code === 'AltRight') {
		keyName = 'Alt';
	} else if (e.code === 'MetaLeft' || e.code === 'MetaRight') {
		keyName = '⌘';
	} else {
		keyName = keyMap[e.code] || e.code;
	}
	
	if (keyName && !parts.includes(keyName)) {
		parts.push(keyName);
	}
	
	return parts.join(' + ') || e.code;
}

/**
 * Get the key code from a keyboard event, including modifiers
 */
export function getKeyCode(e: KeyboardEvent): string {
	const parts: string[] = [];
	
	if (e.ctrlKey && e.code !== 'ControlLeft' && e.code !== 'ControlRight') {
		parts.push('Ctrl');
	}
	if (e.shiftKey && e.code !== 'ShiftLeft' && e.code !== 'ShiftRight') {
		parts.push('Shift');
	}
	if (e.altKey && e.code !== 'AltLeft' && e.code !== 'AltRight') {
		parts.push('Alt');
	}
	if (e.metaKey && e.code !== 'MetaLeft' && e.code !== 'MetaRight') {
		parts.push('Meta');
	}
	
	parts.push(e.code);
	
	return parts.join('+');
}

function createPushToTalkStore() {
	const { subscribe, set, update } = writable<PushToTalkState>(initialState);
	
	let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
	let keyupHandler: ((e: KeyboardEvent) => void) | null = null;
	let blurHandler: (() => void) | null = null;
	
	/**
	 * Check if a keyboard event matches the configured PTT key
	 */
	function matchesPTTKey(e: KeyboardEvent): boolean {
		const voice = get(voiceSettings);
		const configuredKey = voice.pushToTalkKey;
		const eventKey = getKeyCode(e);
		return eventKey === configuredKey;
	}
	
	/**
	 * Handle push-to-talk key press
	 */
	function handleKeyDown(e: KeyboardEvent) {
		const state = get({ subscribe });
		const voice = get(voiceSettings);
		const inCall = get(isInVoiceCall);
		
		// If capturing a new keybind, don't process as PTT
		if (state.isCapturingKey) {
			return;
		}
		
		// Only activate PTT in push_to_talk mode while in a voice call
		if (voice.inputMode !== 'push_to_talk' || !inCall) {
			return;
		}
		
		if (matchesPTTKey(e) && !state.isKeyPressed) {
			e.preventDefault();
			update(s => ({ ...s, isKeyPressed: true, isRecording: true }));
			
			// Unmute while key is held
			const currentState = get(voiceCall);
			if (currentState.muted) {
				voiceCall.toggleMute();
			}
			voiceCall.setSpeaking(true);
		}
	}
	
	/**
	 * Handle push-to-talk key release
	 */
	function handleKeyUp(e: KeyboardEvent) {
		const state = get({ subscribe });
		const voice = get(voiceSettings);
		const inCall = get(isInVoiceCall);
		
		if (state.isCapturingKey) {
			return;
		}
		
		if (voice.inputMode !== 'push_to_talk' || !inCall) {
			return;
		}
		
		if (matchesPTTKey(e) && state.isKeyPressed) {
			e.preventDefault();
			update(s => ({ ...s, isKeyPressed: false, isRecording: false }));
			
			// Mute when key is released
			const currentState = get(voiceCall);
			if (!currentState.muted) {
				voiceCall.toggleMute();
			}
			voiceCall.setSpeaking(false);
		}
	}
	
	/**
	 * Handle window blur (release key when window loses focus)
	 */
	function handleBlur() {
		const state = get({ subscribe });
		if (state.isKeyPressed) {
			update(s => ({ ...s, isKeyPressed: false, isRecording: false }));
			
			const currentState = get(voiceCall);
			if (!currentState.muted) {
				voiceCall.toggleMute();
			}
			voiceCall.setSpeaking(false);
		}
	}
	
	return {
		subscribe,
		
		/**
		 * Initialize PTT event listeners
		 */
		init() {
			if (!browser) return;
			
			keydownHandler = handleKeyDown;
			keyupHandler = handleKeyUp;
			blurHandler = handleBlur;
			
			window.addEventListener('keydown', keydownHandler);
			window.addEventListener('keyup', keyupHandler);
			window.addEventListener('blur', blurHandler);
		},
		
		/**
		 * Cleanup PTT event listeners
		 */
		destroy() {
			if (!browser) return;
			
			if (keydownHandler) {
				window.removeEventListener('keydown', keydownHandler);
			}
			if (keyupHandler) {
				window.removeEventListener('keyup', keyupHandler);
			}
			if (blurHandler) {
				window.removeEventListener('blur', blurHandler);
			}
		},
		
		/**
		 * Start capturing a new keybind
		 */
		startCapture() {
			update(s => ({ 
				...s, 
				isCapturingKey: true, 
				lastCapturedKey: null,
				lastCapturedKeyDisplay: null
			}));
		},
		
		/**
		 * Capture a key for the PTT binding
		 */
		captureKey(e: KeyboardEvent) {
			e.preventDefault();
			e.stopPropagation();
			
			// Ignore escape (used to cancel capture)
			if (e.code === 'Escape') {
				update(s => ({ 
					...s, 
					isCapturingKey: false,
					lastCapturedKey: null,
					lastCapturedKeyDisplay: null
				}));
				return;
			}
			
			const keyCode = getKeyCode(e);
			const keyDisplay = formatKeyDisplay(e);
			
			update(s => ({
				...s,
				isCapturingKey: false,
				lastCapturedKey: keyCode,
				lastCapturedKeyDisplay: keyDisplay
			}));
			
			// Save to settings
			settings.updateVoice({
				pushToTalkKey: keyCode,
				pushToTalkKeyDisplay: keyDisplay
			});
		},
		
		/**
		 * Cancel key capture
		 */
		cancelCapture() {
			update(s => ({ 
				...s, 
				isCapturingKey: false,
				lastCapturedKey: null,
				lastCapturedKeyDisplay: null
			}));
		},
		
		/**
		 * Reset PTT state (called when leaving voice channel)
		 */
		reset() {
			set(initialState);
		}
	};
}

export const pushToTalk = createPushToTalkStore();

// Derived stores for convenience
export const isPTTPressed = derived(pushToTalk, $ptt => $ptt.isKeyPressed);
export const isPTTRecording = derived(pushToTalk, $ptt => $ptt.isRecording);
export const isCapturingPTTKey = derived(pushToTalk, $ptt => $ptt.isCapturingKey);
