<script lang="ts">
    /**
     * Onboarding Component
     * 
     * Multi-step wizard for first-time desktop app users.
     * Guides through theme, notifications, shortcuts, and key features.
     */
    
    import { onMount, createEventDispatcher } from 'svelte';
    import { fade, fly, scale } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { onboarding, currentOnboardingStep } from '../stores/onboarding';
    import { setThemeMode, effectiveTheme } from '../stores/systemTheme';
    import { invoke } from '@tauri-apps/api/core';
    
    const dispatch = createEventDispatcher<{ complete: void; skip: void }>();
    
    // Step definitions
    const steps = [
        { id: 'welcome', title: 'Welcome' },
        { id: 'theme', title: 'Appearance' },
        { id: 'notifications', title: 'Notifications' },
        { id: 'shortcuts', title: 'Shortcuts' },
        { id: 'ready', title: 'Ready!' },
    ];
    
    // Local state
    let selectedTheme: 'system' | 'light' | 'dark' = 'system';
    let notificationsEnabled = true;
    let soundAlertsEnabled = true;
    let autoLaunchEnabled = false;
    let minimizeToTrayEnabled = true;
    let animating = false;
    
    $: currentStep = $currentOnboardingStep;
    $: progress = ((currentStep + 1) / steps.length) * 100;
    $: isLastStep = currentStep === steps.length - 1;
    $: isFirstStep = currentStep === 0;
    
    // Key shortcuts to display
    const shortcuts = [
        { keys: ['Ctrl/⌘', 'Shift', 'H'], action: 'Toggle window visibility' },
        { keys: ['Ctrl/⌘', 'Shift', 'S'], action: 'Open settings' },
        { keys: ['Ctrl/⌘', 'Shift', 'M'], action: 'Toggle mute' },
        { keys: ['Ctrl/⌘', 'K'], action: 'Quick search' },
    ];
    
    async function handleNext() {
        if (animating) return;
        animating = true;
        
        // Save preferences for current step
        if (currentStep === 1) {
            setThemeMode(selectedTheme);
            onboarding.setPreference('theme', selectedTheme);
        } else if (currentStep === 2) {
            onboarding.setPreference('notifications', notificationsEnabled);
            onboarding.setPreference('soundAlerts', soundAlertsEnabled);
            onboarding.setPreference('autoLaunch', autoLaunchEnabled);
            onboarding.setPreference('minimizeToTray', minimizeToTrayEnabled);
            
            // Apply auto-launch setting via Tauri
            if (autoLaunchEnabled) {
                try {
                    await invoke('set_auto_launch', { enabled: true });
                } catch (e) {
                    console.warn('Failed to enable auto-launch:', e);
                }
            }
        }
        
        onboarding.completeStep(steps[currentStep].id);
        
        if (isLastStep) {
            onboarding.complete();
            dispatch('complete');
        } else {
            onboarding.nextStep();
        }
        
        setTimeout(() => animating = false, 300);
    }
    
    function handleBack() {
        if (animating || isFirstStep) return;
        animating = true;
        onboarding.prevStep();
        setTimeout(() => animating = false, 300);
    }
    
    function handleSkip() {
        onboarding.skip();
        dispatch('skip');
    }
    
    function selectTheme(theme: 'system' | 'light' | 'dark') {
        selectedTheme = theme;
        setThemeMode(theme); // Preview immediately
    }
    
    onMount(() => {
        // Check current theme preference
        selectedTheme = $effectiveTheme === 'dark' ? 'system' : 'system';
    });
</script>

<div class="onboarding-overlay" transition:fade={{ duration: 300 }}>
    <div class="onboarding-container" transition:scale={{ duration: 300, easing: cubicOut }}>
        <!-- Progress Bar -->
        <div class="progress-bar">
            <div class="progress-fill" style="width: {progress}%"></div>
        </div>
        
        <!-- Step Indicators -->
        <div class="step-indicators">
            {#each steps as step, i}
                <button
                    class="step-dot"
                    class:active={i === currentStep}
                    class:completed={i < currentStep}
                    on:click={() => i < currentStep && onboarding.goToStep(i)}
                    disabled={i > currentStep}
                    aria-label={step.title}
                >
                    {#if i < currentStep}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    {/if}
                </button>
            {/each}
        </div>
        
        <!-- Content Area -->
        <div class="content-area">
            {#key currentStep}
                <div class="step-content" in:fly={{ x: 50, duration: 300, delay: 100 }} out:fly={{ x: -50, duration: 200 }}>
                    
                    <!-- Welcome Step -->
                    {#if currentStep === 0}
                        <div class="step-welcome">
                            <div class="logo-container">
                                <div class="logo">🏠</div>
                                <div class="logo-glow"></div>
                            </div>
                            <h1>Welcome to Hearth</h1>
                            <p class="subtitle">Your cozy corner for private conversations</p>
                            <div class="features-preview">
                                <div class="feature">
                                    <span class="feature-icon">🔒</span>
                                    <span>End-to-end encrypted</span>
                                </div>
                                <div class="feature">
                                    <span class="feature-icon">🏠</span>
                                    <span>Self-hosted & private</span>
                                </div>
                                <div class="feature">
                                    <span class="feature-icon">⚡</span>
                                    <span>Lightning fast</span>
                                </div>
                            </div>
                        </div>
                    
                    <!-- Theme Step -->
                    {:else if currentStep === 1}
                        <div class="step-theme">
                            <h2>Choose your vibe</h2>
                            <p class="step-description">Pick a theme that feels right. You can always change it later in settings.</p>
                            
                            <div class="theme-options">
                                <button
                                    class="theme-option"
                                    class:selected={selectedTheme === 'light'}
                                    on:click={() => selectTheme('light')}
                                >
                                    <div class="theme-preview light">
                                        <div class="preview-bar"></div>
                                        <div class="preview-content">
                                            <div class="preview-sidebar"></div>
                                            <div class="preview-main">
                                                <div class="preview-line"></div>
                                                <div class="preview-line short"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <span class="theme-label">☀️ Light</span>
                                </button>
                                
                                <button
                                    class="theme-option"
                                    class:selected={selectedTheme === 'dark'}
                                    on:click={() => selectTheme('dark')}
                                >
                                    <div class="theme-preview dark">
                                        <div class="preview-bar"></div>
                                        <div class="preview-content">
                                            <div class="preview-sidebar"></div>
                                            <div class="preview-main">
                                                <div class="preview-line"></div>
                                                <div class="preview-line short"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <span class="theme-label">🌙 Dark</span>
                                </button>
                                
                                <button
                                    class="theme-option"
                                    class:selected={selectedTheme === 'system'}
                                    on:click={() => selectTheme('system')}
                                >
                                    <div class="theme-preview system">
                                        <div class="preview-bar"></div>
                                        <div class="preview-content">
                                            <div class="preview-sidebar"></div>
                                            <div class="preview-main">
                                                <div class="preview-line"></div>
                                                <div class="preview-line short"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <span class="theme-label">💻 System</span>
                                </button>
                            </div>
                        </div>
                    
                    <!-- Notifications Step -->
                    {:else if currentStep === 2}
                        <div class="step-notifications">
                            <h2>Stay in the loop</h2>
                            <p class="step-description">Configure how Hearth keeps you informed.</p>
                            
                            <div class="notification-options">
                                <label class="toggle-option">
                                    <div class="option-info">
                                        <span class="option-icon">🔔</span>
                                        <div class="option-text">
                                            <span class="option-label">Desktop notifications</span>
                                            <span class="option-description">Get notified when you receive new messages</span>
                                        </div>
                                    </div>
                                    <input type="checkbox" bind:checked={notificationsEnabled} />
                                    <span class="toggle"></span>
                                </label>
                                
                                <label class="toggle-option">
                                    <div class="option-info">
                                        <span class="option-icon">🔊</span>
                                        <div class="option-text">
                                            <span class="option-label">Sound alerts</span>
                                            <span class="option-description">Play a sound for new messages</span>
                                        </div>
                                    </div>
                                    <input type="checkbox" bind:checked={soundAlertsEnabled} />
                                    <span class="toggle"></span>
                                </label>
                                
                                <label class="toggle-option">
                                    <div class="option-info">
                                        <span class="option-icon">🚀</span>
                                        <div class="option-text">
                                            <span class="option-label">Launch at startup</span>
                                            <span class="option-description">Start Hearth when you log in</span>
                                        </div>
                                    </div>
                                    <input type="checkbox" bind:checked={autoLaunchEnabled} />
                                    <span class="toggle"></span>
                                </label>
                                
                                <label class="toggle-option">
                                    <div class="option-info">
                                        <span class="option-icon">📥</span>
                                        <div class="option-text">
                                            <span class="option-label">Minimize to tray</span>
                                            <span class="option-description">Keep running in the background when closed</span>
                                        </div>
                                    </div>
                                    <input type="checkbox" bind:checked={minimizeToTrayEnabled} />
                                    <span class="toggle"></span>
                                </label>
                            </div>
                        </div>
                    
                    <!-- Shortcuts Step -->
                    {:else if currentStep === 3}
                        <div class="step-shortcuts">
                            <h2>Power at your fingertips</h2>
                            <p class="step-description">Use these keyboard shortcuts to navigate Hearth like a pro.</p>
                            
                            <div class="shortcuts-list">
                                {#each shortcuts as shortcut}
                                    <div class="shortcut-item">
                                        <div class="shortcut-keys">
                                            {#each shortcut.keys as key}
                                                <kbd>{key}</kbd>
                                                {#if shortcut.keys.indexOf(key) < shortcut.keys.length - 1}
                                                    <span class="key-separator">+</span>
                                                {/if}
                                            {/each}
                                        </div>
                                        <span class="shortcut-action">{shortcut.action}</span>
                                    </div>
                                {/each}
                            </div>
                            
                            <p class="shortcuts-hint">
                                💡 Tip: Press <kbd>Ctrl/⌘</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd> from anywhere to show Hearth instantly!
                            </p>
                        </div>
                    
                    <!-- Ready Step -->
                    {:else if currentStep === 4}
                        <div class="step-ready">
                            <div class="ready-animation">
                                <div class="checkmark-circle">
                                    <svg viewBox="0 0 52 52">
                                        <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="2"/>
                                        <path fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M14 27l8 8 16-16"/>
                                    </svg>
                                </div>
                            </div>
                            <h2>You're all set!</h2>
                            <p class="step-description">Hearth is ready to use. Enjoy your private, cozy conversations.</p>
                            
                            <div class="ready-summary">
                                <div class="summary-item">
                                    <span class="summary-icon">🎨</span>
                                    <span>Theme: {selectedTheme === 'system' ? 'System' : selectedTheme === 'dark' ? 'Dark' : 'Light'}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-icon">{notificationsEnabled ? '🔔' : '🔕'}</span>
                                    <span>Notifications: {notificationsEnabled ? 'On' : 'Off'}</span>
                                </div>
                                <div class="summary-item">
                                    <span class="summary-icon">{autoLaunchEnabled ? '🚀' : '⏸️'}</span>
                                    <span>Auto-launch: {autoLaunchEnabled ? 'On' : 'Off'}</span>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            {/key}
        </div>
        
        <!-- Navigation Buttons -->
        <div class="navigation">
            <button class="nav-btn secondary" on:click={handleSkip}>
                Skip setup
            </button>
            
            <div class="nav-right">
                {#if !isFirstStep}
                    <button class="nav-btn secondary" on:click={handleBack} disabled={animating}>
                        Back
                    </button>
                {/if}
                
                <button class="nav-btn primary" on:click={handleNext} disabled={animating}>
                    {isLastStep ? 'Get started' : 'Continue'}
                    {#if !isLastStep}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    {/if}
                </button>
            </div>
        </div>
    </div>
</div>

<style>
    .onboarding-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 1rem;
    }
    
    .onboarding-container {
        background: var(--bg-secondary);
        border-radius: 16px;
        width: 100%;
        max-width: 560px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    
    /* Progress Bar */
    .progress-bar {
        height: 4px;
        background: var(--bg-tertiary);
    }
    
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--brand-primary), #a78bfa);
        transition: width 0.3s ease;
    }
    
    /* Step Indicators */
    .step-indicators {
        display: flex;
        justify-content: center;
        gap: 0.75rem;
        padding: 1.5rem 1rem 0.5rem;
    }
    
    .step-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--bg-tertiary);
        border: 2px solid var(--bg-modifier-accent);
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
    }
    
    .step-dot:disabled {
        cursor: default;
    }
    
    .step-dot.active {
        background: var(--brand-primary);
        border-color: var(--brand-primary);
        transform: scale(1.2);
    }
    
    .step-dot.completed {
        background: var(--status-online);
        border-color: var(--status-online);
    }
    
    .step-dot svg {
        width: 8px;
        height: 8px;
        color: white;
    }
    
    /* Content Area */
    .content-area {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem 2rem;
        min-height: 400px;
    }
    
    .step-content {
        height: 100%;
    }
    
    h1 {
        font-size: 2rem;
        font-weight: 700;
        text-align: center;
        margin: 0 0 0.5rem;
        color: var(--text-primary);
    }
    
    h2 {
        font-size: 1.5rem;
        font-weight: 600;
        text-align: center;
        margin: 0 0 0.5rem;
        color: var(--text-primary);
    }
    
    .subtitle, .step-description {
        text-align: center;
        color: var(--text-secondary);
        margin-bottom: 2rem;
    }
    
    /* Welcome Step */
    .step-welcome {
        text-align: center;
    }
    
    .logo-container {
        position: relative;
        display: inline-block;
        margin-bottom: 1.5rem;
    }
    
    .logo {
        font-size: 4rem;
        position: relative;
        z-index: 1;
        animation: float 3s ease-in-out infinite;
    }
    
    .logo-glow {
        position: absolute;
        inset: -20px;
        background: radial-gradient(circle, rgba(139, 148, 247, 0.3) 0%, transparent 70%);
        border-radius: 50%;
        animation: pulse 2s ease-in-out infinite;
    }
    
    @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 0.5; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.1); }
    }
    
    .features-preview {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-top: 2rem;
    }
    
    .feature {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.5rem;
        background: var(--bg-tertiary);
        border-radius: 12px;
        color: var(--text-primary);
    }
    
    .feature-icon {
        font-size: 1.5rem;
    }
    
    /* Theme Step */
    .theme-options {
        display: flex;
        gap: 1rem;
        justify-content: center;
    }
    
    .theme-option {
        flex: 1;
        max-width: 140px;
        padding: 0;
        background: var(--bg-tertiary);
        border: 2px solid transparent;
        border-radius: 12px;
        cursor: pointer;
        overflow: hidden;
        transition: all 0.2s ease;
    }
    
    .theme-option:hover {
        border-color: var(--bg-modifier-accent);
        transform: translateY(-2px);
    }
    
    .theme-option.selected {
        border-color: var(--brand-primary);
        box-shadow: 0 0 0 2px rgba(139, 148, 247, 0.2);
    }
    
    .theme-preview {
        padding: 0.75rem;
        aspect-ratio: 4/3;
    }
    
    .theme-preview.light {
        background: #ffffff;
    }
    
    .theme-preview.dark {
        background: #1e1f22;
    }
    
    .theme-preview.system {
        background: linear-gradient(135deg, #ffffff 50%, #1e1f22 50%);
    }
    
    .theme-preview .preview-bar {
        height: 8px;
        background: rgba(128, 128, 128, 0.3);
        border-radius: 4px;
        margin-bottom: 0.5rem;
    }
    
    .theme-preview .preview-content {
        display: flex;
        gap: 0.5rem;
        height: calc(100% - 16px);
    }
    
    .theme-preview .preview-sidebar {
        width: 30%;
        background: rgba(128, 128, 128, 0.2);
        border-radius: 4px;
    }
    
    .theme-preview .preview-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    
    .theme-preview .preview-line {
        height: 6px;
        background: rgba(128, 128, 128, 0.3);
        border-radius: 3px;
    }
    
    .theme-preview .preview-line.short {
        width: 60%;
    }
    
    .theme-label {
        display: block;
        padding: 0.75rem;
        font-weight: 500;
        color: var(--text-primary);
        background: var(--bg-secondary);
    }
    
    /* Notifications Step */
    .notification-options {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    
    .toggle-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        background: var(--bg-tertiary);
        border-radius: 12px;
        cursor: pointer;
        transition: background 0.2s ease;
    }
    
    .toggle-option:hover {
        background: var(--bg-modifier-hover);
    }
    
    .option-info {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    
    .option-icon {
        font-size: 1.5rem;
    }
    
    .option-text {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }
    
    .option-label {
        font-weight: 500;
        color: var(--text-primary);
    }
    
    .option-description {
        font-size: 0.8125rem;
        color: var(--text-secondary);
    }
    
    .toggle-option input {
        display: none;
    }
    
    .toggle {
        position: relative;
        width: 44px;
        height: 24px;
        background: var(--bg-modifier-accent);
        border-radius: 12px;
        transition: background 0.2s ease;
        flex-shrink: 0;
    }
    
    .toggle::after {
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
    
    .toggle-option input:checked + .toggle {
        background: var(--brand-primary);
    }
    
    .toggle-option input:checked + .toggle::after {
        transform: translateX(20px);
    }
    
    /* Shortcuts Step */
    .shortcuts-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
    }
    
    .shortcut-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.875rem 1rem;
        background: var(--bg-tertiary);
        border-radius: 10px;
    }
    
    .shortcut-keys {
        display: flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    kbd {
        display: inline-block;
        padding: 0.25rem 0.5rem;
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 500;
        background: var(--bg-secondary);
        border: 1px solid var(--border-subtle);
        border-radius: 4px;
        color: var(--text-primary);
        box-shadow: 0 1px 0 var(--border-subtle);
    }
    
    .key-separator {
        color: var(--text-muted);
        font-size: 0.75rem;
    }
    
    .shortcut-action {
        color: var(--text-secondary);
        font-size: 0.875rem;
    }
    
    .shortcuts-hint {
        text-align: center;
        padding: 1rem;
        background: rgba(139, 148, 247, 0.1);
        border-radius: 10px;
        color: var(--text-secondary);
        font-size: 0.875rem;
    }
    
    .shortcuts-hint kbd {
        margin: 0 0.125rem;
    }
    
    /* Ready Step */
    .step-ready {
        text-align: center;
    }
    
    .ready-animation {
        margin-bottom: 1.5rem;
    }
    
    .checkmark-circle {
        width: 80px;
        height: 80px;
        margin: 0 auto;
        color: var(--status-online);
    }
    
    .checkmark-circle svg {
        animation: checkmark 0.5s ease-out forwards;
    }
    
    .checkmark-circle circle {
        stroke-dasharray: 160;
        stroke-dashoffset: 160;
        animation: circle 0.6s ease-out forwards;
    }
    
    .checkmark-circle path {
        stroke-dasharray: 50;
        stroke-dashoffset: 50;
        animation: check 0.3s ease-out 0.4s forwards;
    }
    
    @keyframes circle {
        to { stroke-dashoffset: 0; }
    }
    
    @keyframes check {
        to { stroke-dashoffset: 0; }
    }
    
    .ready-summary {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 1.5rem;
        padding: 1rem;
        background: var(--bg-tertiary);
        border-radius: 12px;
    }
    
    .summary-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: var(--text-secondary);
        font-size: 0.875rem;
    }
    
    .summary-icon {
        font-size: 1rem;
    }
    
    /* Navigation */
    .navigation {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 2rem 1.5rem;
        border-top: 1px solid var(--border-subtle);
    }
    
    .nav-right {
        display: flex;
        gap: 0.75rem;
    }
    
    .nav-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.25rem;
        font-size: 0.875rem;
        font-weight: 500;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .nav-btn.primary {
        background: var(--brand-primary);
        color: white;
    }
    
    .nav-btn.primary:hover:not(:disabled) {
        filter: brightness(1.1);
    }
    
    .nav-btn.primary:active:not(:disabled) {
        transform: scale(0.98);
    }
    
    .nav-btn.secondary {
        background: transparent;
        color: var(--text-secondary);
    }
    
    .nav-btn.secondary:hover:not(:disabled) {
        color: var(--text-primary);
        background: var(--bg-modifier-hover);
    }
    
    .nav-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .nav-btn svg {
        width: 16px;
        height: 16px;
    }
    
    /* Reduced motion support */
    @media (prefers-reduced-motion: reduce) {
        .logo, .logo-glow, .checkmark-circle svg, .checkmark-circle circle, .checkmark-circle path {
            animation: none;
        }
        
        .step-content {
            transition: none;
        }
    }
</style>
