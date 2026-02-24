/**
 * System Theme Store
 * 
 * Integrates with native OS theme detection via Tauri.
 * Automatically syncs the app's theme with the system preference.
 */

import { writable, derived, get } from 'svelte/store';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type SystemTheme = 'light' | 'dark';

export interface ThemeInfo {
    theme: SystemTheme;
    is_dark: boolean;
    accent_color: string | null;
    high_contrast: boolean;
    reduced_motion: boolean;
    reduced_transparency: boolean;
}

export interface ThemePreferences {
    mode: 'system' | 'light' | 'dark';
    respectSystemAccent: boolean;
    respectReducedMotion: boolean;
    respectHighContrast: boolean;
}

// Default theme info
const defaultThemeInfo: ThemeInfo = {
    theme: 'light',
    is_dark: false,
    accent_color: null,
    high_contrast: false,
    reduced_motion: false,
    reduced_transparency: false,
};

// User preferences for theme handling
const defaultPreferences: ThemePreferences = {
    mode: 'system',
    respectSystemAccent: true,
    respectReducedMotion: true,
    respectHighContrast: true,
};

// Stores
export const systemThemeInfo = writable<ThemeInfo>(defaultThemeInfo);
export const themePreferences = writable<ThemePreferences>(defaultPreferences);
export const isInitialized = writable(false);

// Derived store for the effective theme
export const effectiveTheme = derived(
    [systemThemeInfo, themePreferences],
    ([$systemThemeInfo, $prefs]) => {
        if ($prefs.mode === 'system') {
            return $systemThemeInfo.is_dark ? 'dark' : 'light';
        }
        return $prefs.mode;
    }
);

// Derived store for effective accent color
export const effectiveAccentColor = derived(
    [systemThemeInfo, themePreferences],
    ([$systemThemeInfo, $prefs]) => {
        if ($prefs.respectSystemAccent && $systemThemeInfo.accent_color) {
            return $systemThemeInfo.accent_color;
        }
        return '#007aff'; // Default blue
    }
);

// Derived store for motion preferences
export const prefersReducedMotion = derived(
    [systemThemeInfo, themePreferences],
    ([$systemThemeInfo, $prefs]) => {
        return $prefs.respectReducedMotion && $systemThemeInfo.reduced_motion;
    }
);

// Derived store for high contrast
export const prefersHighContrast = derived(
    [systemThemeInfo, themePreferences],
    ([$systemThemeInfo, $prefs]) => {
        return $prefs.respectHighContrast && $systemThemeInfo.high_contrast;
    }
);

// Listener cleanup function
let unlisten: UnlistenFn | null = null;

/**
 * Initialize the theme system
 * Sets up event listeners and fetches initial theme
 */
export async function initializeTheme(): Promise<void> {
    try {
        // Load saved preferences from localStorage
        const savedPrefs = localStorage.getItem('theme-preferences');
        if (savedPrefs) {
            try {
                const parsed = JSON.parse(savedPrefs);
                themePreferences.set({ ...defaultPreferences, ...parsed });
            } catch (e) {
                console.warn('Failed to parse saved theme preferences:', e);
            }
        }

        // Get initial theme info from Tauri
        const info = await invoke<ThemeInfo>('get_theme_info');
        systemThemeInfo.set(info);

        // Listen for theme changes from the native side
        unlisten = await listen<ThemeInfo>('system-theme-changed', (event) => {
            systemThemeInfo.set(event.payload);
            applyThemeToDOM();
        });

        // Apply initial theme
        applyThemeToDOM();
        
        isInitialized.set(true);
    } catch (error) {
        console.warn('Theme initialization failed (may not be in Tauri context):', error);
        // Fall back to browser preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        systemThemeInfo.set({
            ...defaultThemeInfo,
            theme: prefersDark ? 'dark' : 'light',
            is_dark: prefersDark,
            reduced_motion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        });
        
        // Listen for browser media query changes as fallback
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            systemThemeInfo.update(info => ({
                ...info,
                theme: e.matches ? 'dark' : 'light',
                is_dark: e.matches,
            }));
            applyThemeToDOM();
        });
        
        applyThemeToDOM();
        isInitialized.set(true);
    }
}

/**
 * Apply the current theme to the DOM
 */
function applyThemeToDOM(): void {
    const theme = get(effectiveTheme);
    const accentColor = get(effectiveAccentColor);
    const reducedMotion = get(prefersReducedMotion);
    const highContrast = get(prefersHighContrast);
    const info = get(systemThemeInfo);
    
    const root = document.documentElement;
    
    // Set theme class
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.setAttribute('data-theme', theme);
    
    // Set CSS custom properties
    root.style.setProperty('--system-accent-color', accentColor);
    
    // Set accessibility classes
    root.classList.toggle('reduced-motion', reducedMotion);
    root.classList.toggle('high-contrast', highContrast);
    root.classList.toggle('reduced-transparency', info.reduced_transparency);
    
    // Update meta theme-color for mobile/PWA
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', theme === 'dark' ? '#1e1e2e' : '#ffffff');
    }
}

/**
 * Update theme preferences
 */
export function setThemePreferences(prefs: Partial<ThemePreferences>): void {
    themePreferences.update(current => {
        const updated = { ...current, ...prefs };
        // Save to localStorage
        localStorage.setItem('theme-preferences', JSON.stringify(updated));
        return updated;
    });
    applyThemeToDOM();
}

/**
 * Set the theme mode directly
 */
export function setThemeMode(mode: 'system' | 'light' | 'dark'): void {
    setThemePreferences({ mode });
}

/**
 * Toggle between light and dark mode
 * If in system mode, switches to the opposite of current system theme
 */
export function toggleTheme(): void {
    const prefs = get(themePreferences);
    const currentEffective = get(effectiveTheme);
    
    if (prefs.mode === 'system') {
        // Switch to manual mode with opposite theme
        setThemeMode(currentEffective === 'dark' ? 'light' : 'dark');
    } else {
        // Toggle manual mode
        setThemeMode(prefs.mode === 'dark' ? 'light' : 'dark');
    }
}

/**
 * Reset to system theme
 */
export function useSystemTheme(): void {
    setThemeMode('system');
}

/**
 * Get the current system theme (without user preference override)
 */
export async function getSystemTheme(): Promise<SystemTheme> {
    try {
        return await invoke<SystemTheme>('get_system_theme');
    } catch {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
}

/**
 * Check if currently in dark mode (considering user preferences)
 */
export function isDarkMode(): boolean {
    return get(effectiveTheme) === 'dark';
}

/**
 * Cleanup theme listeners
 */
export function cleanupTheme(): void {
    if (unlisten) {
        unlisten();
        unlisten = null;
    }
}

// Subscribe to preference changes to apply them
themePreferences.subscribe(() => {
    if (get(isInitialized)) {
        applyThemeToDOM();
    }
});
