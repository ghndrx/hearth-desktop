/**
 * Notification sounds module
 * Uses HTML5 Audio API for cross-platform compatibility
 */

import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { appSettings } from '$lib/stores/settings';
import { user } from '$lib/stores/auth';

export type SoundType = 'message' | 'mention' | 'call';

// Simple notification sounds as base64 data URIs
// These are short, low-frequency tones suitable for notifications
const SOUNDS: Record<SoundType, string> = {
	// Gentle "pop" sound for message received
	message: 'data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAAAAAAEAAgADAAQABQAGAAcACAAJAAoACwAMAA0ADgAPABAAEQASABMAFAAVABYAFwAYABkAGgAbABwAHQAeAB8AIAAhACIAIwAkACUAJgAnACgAKQAqACsALAAtAC4ALwAwADEAMgAzADQANQA2ADcAOAA5ADoAOwA8AD0APgA/AEAAQQBCAEMARABFAEYARwBIAEkASgBLAEwATQBOAE8AUABRAFIAUwBUAFUAVgBXAFgAWQBaAFsAXABdAF4AXwBgAGEAYgBjAGQAZQBmAGcAaABpAGoAawBsAG0AbgBvAHAAcQByAHMAcwBzAHMAcwBzAHMAcgByAHEAcQBwAHAAcABvAG8AbgBtAGwAawBqAGkAaABnAGYAZQBkAGMAYgBhAGAAXwBeAF0AXABbAFoAWQBYAFcAVgBVAFQAUwBSAFEAUABPAE4ATQBMAEsASgBJAEgARwBGAEUARABDAEIAQQBAAD8APgA9ADwAOwA6ADkAOAA3ADYANQAzADIAMQAwAC8ALgAtACwAKwAqACkAKAAnACYAJQAkACMAIgAhACAAHwAeAB0AHAAbABoAGQAYABcAFgAVABQAEwASABEAEAAPAA4ADQAMAAsACgAJAAgABwAGAAUABAADAAIAAQAAAP//AgAEAAYACAAKAAwADgAQABIAFAAWABgAGgAcAB4AIAAiACQAJgAoACoALAAuADAAMgA0ADYAOABCAEwAVgBgAGoAdAB+AIgAkgCcAKYAsAC6AMQAzgDYAOIA7AD2AP//CAAPABUAGgAfACMAJgAoACkAKQAoACYAIwAfABoAFAAPAAoABAAA//f/8f/r/+b/4f/d/9n/1v/U/9L/0f/R/9L/0//U/9b/2P/b/97/4f/k/+j/6//u//H/9f/3//r//P///wEAAwAFAAcACQAKAAwADQAOAA8AEAARAxISEhIRERAQDw8ODg0NDAsMCwoKCQoJCAcHBwYGBgUFBQQEBAMDAwMCAgICAgICAgICAgECAQIBAgECAQIBAgEBAQEBAQEBAQEBAQEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAD///////////////////////8A',
	
	// Higher-pitched "ding" for mentions
	mention: 'data:audio/wav;base64,UklGRl4FAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YToFAAABAAIAAwAEAAUABgAIAAkACwAMAA4AEAASABQAFgAYABoAHAAeACEAIwAlACgAKgAtAC8AMgA1ADgAOwA+AEEARABHAEoATgBRAFQAWABbAF8AYwBmAGoAbgByAHYAegB+AIIAhgCKAI4AkgCWAJoAngCiAKYAqgCuALIAtgC7AL8AwwDHAMsAzwDTANcA2wDfAOMA5wDrAO8A8wD3APsA/wEDAQcBCgEOAREBFQEYARsBHgEhASQBJwEqAS0BMAEzATUBOAE6ATwBPgFAAUIBRAFGAUgBSgFLAU0BTgFQAVEBUgFTAVQBVQFWAVYBVwFXAVgBWAFYAVkBWQFZAVkBWQFZAVgBWAFYAVcBVwFWAVYBVQFUAVMBUgFRAVABTwFNAUwBSgFIAUYBRAFCAUABPgE7ATkBNgEzATABLQEqAScBJAEgAR0BGgEWARMBDwELAQcBAwH/APsA9wDzAO8A6gDmAOIA3gDZANUA0QDMAMgAwwC/ALoAtgCxAK0AqACkAJ8AmwCWAJIAjQCJAIQAgAB7AHcAcgBuAGoAZQBhAF0AWABUAFAASwBHAEMAP QA6ADYAMgAuACoAJgAiAB4AGwAXABMAEAAMAAkABQACAAD//P/5//b/8//w/+7/6//o/+b/4//h/9//3f/b/9n/1//V/9T/0v/R/8//zv/N/8z/y//K/8n/yP/I/8f/x//H/8f/x//H/8f/x//I/8j/yf/K/8v/zP/N/87/0P/R/9P/1f/X/9n/2//e/+D/4//m/+n/7P/v//L/9f/4//z///8CAAYACQANABEAFAAYABwAIAAkACgALAAwADQAOAA8AEAARQBJAEqADkAOgA7ADwAPQA+AD8AQABBAE',
	
	// Rising tones for incoming call
	call: 'data:audio/wav;base64,UklGRoYGAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YWIGAAAACgAUAB4AKAAxADsARABNAFYAXgBmAG4AdgB9AIMAigCQAJYAmwCgAKUAqQCtALEAtAC3ALoAvAC+AMAAwgDDAMQAxQDGAMYAxgDGAMUAxADDAMIAwAC+ALwAuQC2ALMArgCqAKUAoQCbAJYAkACJAIIAewB0AG0AZQBdAFUATQBEADsAMgApACAAFwAOAAUA/f/z/+r/4P/X/87/xf+8/7P/qv+i/5r/kv+K/4L/e/90/23/Z/9h/1z/V/9S/07/Sv9H/0T/Qv9A/z7/Pf89/z3/Pv8//0H/Q/9G/0n/Tv9S/1f/Xf9k/2v/c/97/4P/jP+V/5//qf+z/77/yf/U/+D/7P/4/wQAEQAeACsAOABFAFMAYABtAHoAhwCTAKAAq wC3AMIAzADXAOEA6wD0AP0ABQENARQBGwEhAScBLAExATYBOgE9AUABQwFFAUcBSAFJAUkBSQFJAUkBSAFHAUUBQwFAATwBOQE1ATABKwEmASABGgETAQwBBAH9APQA7ADjANkA0ADGALsAsQCmAJsAjwCDAHcAagBeAFEARAA3ACoAHQAQAAMA9//q/93/0P/D/7f/qv+e/5L/hv96/27/Y/9Y/07/Q/86/zD/J/8e/xb/Dv8H/wD/+v70/u/+6v7m/uL+3/7c/tr+2P7X/tb+1v7W/tf+2P7a/tz+3/7i/ub+6v7v/vT++v4B/wf/D/8X/x//KP8x/zr/RP9O/1n/ZP9w/3v/h/+T/6D/rP+5/8b/0//h/+7//P8JABcAJQAzAEEATwBdAGsAeQCHAJQAogCvALsAyADUAOAA6wD2AAEBCwEVAR4BJwEwATgBPwFGAUwBUgFXAVsBXwFjAWUBZwFpAWoBawFrAWsBaQFoAWYBYwFgAVwBWAFTAU0BRwFAATkBMQEpASABFgEMASEA9wDsAN8A0wDGALgAqgCbAIwAfQBtAF4ATgA+AC4AHgAOAP7/7v/e/87/vv+u/57/jv9+/2//X/9Q/0H/Mv8k/xb/CP/7/u7+4f7V/sn+vv6z/qj+nv6V/oz+g/57/nT+bf5n/mH+XP5Y/lT+Uf5P/k3+TP5L/kv+TP5N/k/+Uf5U/lj+XP5h/mb+bP5y/nn+gP6I/pH+mv6k/q7+uP7D/s7+2v7m/vP+AP8O/xz/Kv84/0f/Vv9l/3X/hf+V/6X/tv/G/9f/6P/5/woAHAAuAEAA'
};

// Audio instances for reuse (prevents loading delay)
const audioCache: Partial<Record<SoundType, HTMLAudioElement>> = {};

/**
 * Initialize audio elements for faster playback
 */
function getAudio(type: SoundType): HTMLAudioElement | null {
	if (!browser) return null;
	
	if (!audioCache[type]) {
		try {
			const audio = new Audio(SOUNDS[type]);
			audio.volume = 0.5;
			audioCache[type] = audio;
		} catch (e) {
			console.error(`Failed to create audio for ${type}:`, e);
			return null;
		}
	}
	
	return audioCache[type] || null;
}

/**
 * Play a notification sound
 */
export function playSound(type: SoundType): void {
	if (!browser) return;
	
	// Check if sounds are enabled
	const settings = get(appSettings);
	if (!settings.enableSounds) return;
	
	const audio = getAudio(type);
	if (!audio) return;
	
	// Reset to beginning if already playing
	audio.currentTime = 0;
	
	// Play (catch promise rejection for autoplay restrictions)
	audio.play().catch(e => {
		// Autoplay may be blocked - this is expected on first interaction
		console.debug('Sound playback blocked:', e.message);
	});
}

/**
 * Check if a message mentions the current user
 */
export function isMention(content: string, userId?: string): boolean {
	if (!userId) {
		const currentUser = get(user);
		userId = currentUser?.id;
	}
	
	if (!userId) return false;
	
	// Check for @everyone, @here, or direct mention
	if (content.includes('@everyone') || content.includes('@here')) {
		return true;
	}
	
	// Check for user mention format: <@userId> or <@!userId>
	const mentionPattern = new RegExp(`<@!?${userId}>`, 'i');
	return mentionPattern.test(content);
}

/**
 * Play appropriate notification sound for a message
 * @param authorId - ID of the message author
 * @param content - Message content to check for mentions
 * @returns The type of sound played, or null if none
 */
export function playMessageNotification(authorId: string, content: string): SoundType | null {
	if (!browser) return null;
	
	const currentUser = get(user);
	
	// Don't play sound for own messages
	if (currentUser?.id === authorId) {
		return null;
	}
	
	// Check for mentions first (higher priority)
	if (isMention(content, currentUser?.id)) {
		playSound('mention');
		return 'mention';
	}
	
	// Regular message
	playSound('message');
	return 'message';
}

/**
 * Play call incoming notification
 */
export function playCallNotification(): void {
	playSound('call');
}

/**
 * Set volume for all sounds (0.0 to 1.0)
 */
export function setVolume(volume: number): void {
	const clampedVolume = Math.max(0, Math.min(1, volume));
	
	Object.values(audioCache).forEach(audio => {
		if (audio) {
			audio.volume = clampedVolume;
		}
	});
}

/**
 * Preload all sounds (call on app init for better UX)
 */
export function preloadSounds(): void {
	if (!browser) return;
	
	Object.keys(SOUNDS).forEach(type => {
		getAudio(type as SoundType);
	});
}
