<script lang="ts">
    /**
     * Theme Settings Component
     * 
     * Allows users to configure theme preferences including:
     * - Light/Dark/System mode
     * - System accent color sync
     * - Accessibility preferences (reduced motion, high contrast)
     */
    
    import { onMount } from 'svelte';
    import {
        systemThemeInfo,
        themePreferences,
        effectiveTheme,
        effectiveAccentColor,
        setThemeMode,
        setThemePreferences,
        initializeTheme,
        isInitialized,
    } from '../stores/systemTheme';
    
    // Theme mode options
    const themeModes = [
        { value: 'system', label: 'System', icon: '💻', description: 'Follow system preference' },
        { value: 'light', label: 'Light', icon: '☀️', description: 'Always use light mode' },
        { value: 'dark', label: 'Dark', icon: '🌙', description: 'Always use dark mode' },
    ] as const;
    
    // Preview colors for theme cards
    $: previewColors = {
        light: { bg: '#ffffff', fg: '#1a1a1a', accent: '#007aff' },
        dark: { bg: '#1e1e2e', fg: '#cdd6f4', accent: '#89b4fa' },
        system: $systemThemeInfo.is_dark 
            ? { bg: '#1e1e2e', fg: '#cdd6f4', accent: '#89b4fa' }
            : { bg: '#ffffff', fg: '#1a1a1a', accent: '#007aff' },
    };
    
    onMount(() => {
        if (!$isInitialized) {
            initializeTheme();
        }
    });
</script>

<div class="theme-settings">
    <h3 class="section-title">Appearance</h3>
    
    <!-- Theme Mode Selection -->
    <div class="theme-mode-section">
        <label class="setting-label">Theme</label>
        <div class="theme-cards">
            {#each themeModes as mode}
                <button
                    class="theme-card"
                    class:selected={$themePreferences.mode === mode.value}
                    on:click={() => setThemeMode(mode.value)}
                    aria-pressed={$themePreferences.mode === mode.value}
                >
                    <div 
                        class="theme-preview"
                        style="
                            background-color: {previewColors[mode.value].bg};
                            color: {previewColors[mode.value].fg};
                        "
                    >
                        <div class="preview-header">
                            <div class="preview-dot" style="background: #ff5f57"></div>
                            <div class="preview-dot" style="background: #febc2e"></div>
                            <div class="preview-dot" style="background: #28c840"></div>
                        </div>
                        <div class="preview-content">
                            <div class="preview-sidebar" style="background: {previewColors[mode.value].fg}20"></div>
                            <div class="preview-main">
                                <div class="preview-line" style="background: {previewColors[mode.value].fg}40; width: 60%"></div>
                                <div class="preview-line" style="background: {previewColors[mode.value].fg}20; width: 80%"></div>
                                <div class="preview-line" style="background: {previewColors[mode.value].accent}; width: 40%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="theme-info">
                        <span class="theme-icon">{mode.icon}</span>
                        <span class="theme-label">{mode.label}</span>
                    </div>
                </button>
            {/each}
        </div>
    </div>
    
    <!-- System Integration -->
    <div class="system-integration">
        <h4 class="subsection-title">System Integration</h4>
        
        {#if $systemThemeInfo.accent_color}
            <label class="toggle-setting">
                <span class="toggle-info">
                    <span class="toggle-label">Use system accent color</span>
                    <span class="toggle-description">
                        Sync with your OS accent color
                        <span 
                            class="accent-preview"
                            style="background-color: {$systemThemeInfo.accent_color}"
                        ></span>
                    </span>
                </span>
                <input
                    type="checkbox"
                    checked={$themePreferences.respectSystemAccent}
                    on:change={(e) => setThemePreferences({ respectSystemAccent: e.currentTarget.checked })}
                />
                <span class="toggle-switch"></span>
            </label>
        {/if}
        
        <label class="toggle-setting">
            <span class="toggle-info">
                <span class="toggle-label">Reduce motion</span>
                <span class="toggle-description">
                    Minimize animations when system preference is set
                    {#if $systemThemeInfo.reduced_motion}
                        <span class="system-badge">System: On</span>
                    {/if}
                </span>
            </span>
            <input
                type="checkbox"
                checked={$themePreferences.respectReducedMotion}
                on:change={(e) => setThemePreferences({ respectReducedMotion: e.currentTarget.checked })}
            />
            <span class="toggle-switch"></span>
        </label>
        
        <label class="toggle-setting">
            <span class="toggle-info">
                <span class="toggle-label">High contrast</span>
                <span class="toggle-description">
                    Increase contrast when system preference is set
                    {#if $systemThemeInfo.high_contrast}
                        <span class="system-badge">System: On</span>
                    {/if}
                </span>
            </span>
            <input
                type="checkbox"
                checked={$themePreferences.respectHighContrast}
                on:change={(e) => setThemePreferences({ respectHighContrast: e.currentTarget.checked })}
            />
            <span class="toggle-switch"></span>
        </label>
    </div>
    
    <!-- Current Status -->
    <div class="current-status">
        <h4 class="subsection-title">Current Status</h4>
        <div class="status-grid">
            <div class="status-item">
                <span class="status-label">Active theme</span>
                <span class="status-value">{$effectiveTheme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
            </div>
            <div class="status-item">
                <span class="status-label">Accent color</span>
                <span class="status-value">
                    <span class="color-swatch" style="background: {$effectiveAccentColor}"></span>
                    {$effectiveAccentColor}
                </span>
            </div>
            <div class="status-item">
                <span class="status-label">System theme</span>
                <span class="status-value">{$systemThemeInfo.is_dark ? 'Dark' : 'Light'}</span>
            </div>
        </div>
    </div>
</div>

<style>
    .theme-settings {
        padding: 1rem;
    }
    
    .section-title {
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 1.5rem;
        color: var(--text-primary);
    }
    
    .subsection-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    
    .setting-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 0.5rem;
    }
    
    /* Theme Cards */
    .theme-cards {
        display: flex;
        gap: 1rem;
        margin-bottom: 2rem;
    }
    
    .theme-card {
        flex: 1;
        padding: 0;
        border: 2px solid var(--border-color);
        border-radius: 12px;
        background: var(--bg-secondary);
        cursor: pointer;
        transition: all 0.2s ease;
        overflow: hidden;
    }
    
    .theme-card:hover {
        border-color: var(--accent-color);
        transform: translateY(-2px);
    }
    
    .theme-card.selected {
        border-color: var(--accent-color);
        box-shadow: 0 0 0 2px var(--accent-color-alpha);
    }
    
    .theme-preview {
        padding: 0.5rem;
        border-radius: 8px 8px 0 0;
        aspect-ratio: 16/10;
    }
    
    .preview-header {
        display: flex;
        gap: 4px;
        margin-bottom: 0.5rem;
    }
    
    .preview-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
    }
    
    .preview-content {
        display: flex;
        gap: 0.5rem;
        height: 100%;
    }
    
    .preview-sidebar {
        width: 20%;
        border-radius: 4px;
    }
    
    .preview-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    
    .preview-line {
        height: 4px;
        border-radius: 2px;
    }
    
    .theme-info {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.75rem;
        background: var(--bg-primary);
    }
    
    .theme-icon {
        font-size: 1rem;
    }
    
    .theme-label {
        font-weight: 500;
        color: var(--text-primary);
    }
    
    /* Toggle Settings */
    .system-integration {
        margin-bottom: 2rem;
    }
    
    .toggle-setting {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        background: var(--bg-secondary);
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s ease;
    }
    
    .toggle-setting:hover {
        background: var(--bg-tertiary);
    }
    
    .toggle-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .toggle-label {
        font-weight: 500;
        color: var(--text-primary);
    }
    
    .toggle-description {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .accent-preview {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 1px solid var(--border-color);
    }
    
    .system-badge {
        font-size: 0.75rem;
        padding: 0.125rem 0.5rem;
        background: var(--accent-color-alpha);
        color: var(--accent-color);
        border-radius: 999px;
    }
    
    .toggle-setting input[type="checkbox"] {
        display: none;
    }
    
    .toggle-switch {
        position: relative;
        width: 44px;
        height: 24px;
        background: var(--bg-tertiary);
        border-radius: 12px;
        transition: background 0.2s ease;
    }
    
    .toggle-switch::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        transition: transform 0.2s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    
    .toggle-setting input:checked + .toggle-switch {
        background: var(--accent-color);
    }
    
    .toggle-setting input:checked + .toggle-switch::after {
        transform: translateX(20px);
    }
    
    /* Status Grid */
    .current-status {
        padding: 1rem;
        background: var(--bg-secondary);
        border-radius: 12px;
    }
    
    .status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
    }
    
    .status-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .status-label {
        font-size: 0.75rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    
    .status-value {
        font-weight: 500;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    .color-swatch {
        display: inline-block;
        width: 16px;
        height: 16px;
        border-radius: 4px;
        border: 1px solid var(--border-color);
    }
    
    /* Reduced Motion */
    :global(.reduced-motion) .theme-card,
    :global(.reduced-motion) .toggle-switch,
    :global(.reduced-motion) .toggle-switch::after {
        transition: none;
    }
    
    /* High Contrast */
    :global(.high-contrast) .theme-card {
        border-width: 3px;
    }
    
    :global(.high-contrast) .toggle-switch {
        border: 2px solid var(--text-primary);
    }
</style>
