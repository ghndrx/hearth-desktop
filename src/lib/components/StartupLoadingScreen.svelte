<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut, elasticOut } from 'svelte/easing';
  
  /** Loading state message */
  export let message: string = 'Initializing...';
  
  /** Current loading progress (0-100) */
  export let progress: number = 0;
  
  /** Whether to show determinate progress */
  export let showProgress: boolean = false;
  
  /** App version to display */
  export let version: string = '';
  
  /** Loading stages for enhanced UX */
  export let stages: string[] = [
    'Connecting to services...',
    'Loading preferences...',
    'Syncing messages...',
    'Almost ready...'
  ];
  
  /** Whether loading is complete */
  export let complete: boolean = false;
  
  /** Callback when loading screen should hide */
  export let onComplete: (() => void) | null = null;
  
  let currentStage = 0;
  let dots = '';
  let showLogo = false;
  let showContent = false;
  let mounted = false;
  
  // Animated dots for indeterminate loading
  let dotsInterval: ReturnType<typeof setInterval>;
  
  function animateDots() {
    dotsInterval = setInterval(() => {
      dots = dots.length >= 3 ? '' : dots + '.';
    }, 400);
  }
  
  // Progress through stages based on progress value
  $: {
    if (showProgress && stages.length > 0) {
      const stageSize = 100 / stages.length;
      currentStage = Math.min(
        Math.floor(progress / stageSize),
        stages.length - 1
      );
      message = stages[currentStage];
    }
  }
  
  // Handle completion animation
  $: if (complete && mounted) {
    setTimeout(() => {
      onComplete?.();
    }, 800);
  }
  
  onMount(() => {
    mounted = true;
    
    // Stagger the entrance animations
    setTimeout(() => {
      showLogo = true;
    }, 100);
    
    setTimeout(() => {
      showContent = true;
    }, 400);
    
    animateDots();
  });
  
  onDestroy(() => {
    if (dotsInterval) {
      clearInterval(dotsInterval);
    }
  });
</script>

<div 
  class="startup-screen" 
  class:complete
  transition:fade={{ duration: 400, easing: cubicOut }}
>
  <div class="content-wrapper">
    <!-- Logo with pulse animation -->
    {#if showLogo}
      <div 
        class="logo-container"
        transition:scale={{ duration: 600, easing: elasticOut, start: 0.5 }}
      >
        <div class="logo">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Hearth flame icon -->
            <path 
              d="M32 4C32 4 14 18 14 36C14 48 22 56 32 58C42 56 50 48 50 36C50 18 32 4 32 4Z" 
              fill="url(#flame-gradient)"
              class="flame-outer"
            />
            <path 
              d="M32 16C32 16 22 26 22 38C22 46 26 52 32 54C38 52 42 46 42 38C42 26 32 16 32 16Z" 
              fill="url(#flame-inner-gradient)"
              class="flame-inner"
            />
            <defs>
              <linearGradient id="flame-gradient" x1="32" y1="4" x2="32" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#ff9500" />
                <stop offset="100%" stop-color="#ff5722" />
              </linearGradient>
              <linearGradient id="flame-inner-gradient" x1="32" y1="16" x2="32" y2="54" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#ffeb3b" />
                <stop offset="100%" stop-color="#ff9800" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="glow" />
      </div>
    {/if}
    
    <!-- App name -->
    {#if showContent}
      <h1 
        class="app-name"
        transition:fade={{ duration: 300, delay: 100 }}
      >
        Hearth
      </h1>
      
      <!-- Loading indicator -->
      <div 
        class="loading-section"
        transition:fade={{ duration: 300, delay: 200 }}
      >
        {#if showProgress}
          <!-- Determinate progress bar -->
          <div class="progress-bar-container">
            <div 
              class="progress-bar-fill" 
              style="width: {progress}%"
            />
          </div>
          <span class="progress-text">{Math.round(progress)}%</span>
        {:else}
          <!-- Indeterminate spinner -->
          <div class="spinner">
            <div class="spinner-ring" />
          </div>
        {/if}
        
        <!-- Status message -->
        <p class="status-message">
          {message}{dots}
        </p>
      </div>
      
      <!-- Version -->
      {#if version}
        <span 
          class="version"
          transition:fade={{ duration: 300, delay: 300 }}
        >
          v{version}
        </span>
      {/if}
    {/if}
  </div>
  
  <!-- Background effects -->
  <div class="bg-gradient" />
  <div class="bg-pattern" />
</div>

<style>
  .startup-screen {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary, #1a1a2e);
    z-index: 9999;
    overflow: hidden;
  }
  
  .startup-screen.complete {
    pointer-events: none;
  }
  
  .content-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    z-index: 1;
  }
  
  /* Logo */
  .logo-container {
    position: relative;
    width: 96px;
    height: 96px;
  }
  
  .logo {
    width: 100%;
    height: 100%;
    animation: float 3s ease-in-out infinite;
  }
  
  .logo svg {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 4px 20px rgba(255, 149, 0, 0.4));
  }
  
  .flame-outer {
    animation: flicker 2s ease-in-out infinite alternate;
  }
  
  .flame-inner {
    animation: flicker 1.5s ease-in-out infinite alternate-reverse;
  }
  
  .glow {
    position: absolute;
    inset: -20px;
    background: radial-gradient(
      circle at center,
      rgba(255, 149, 0, 0.3) 0%,
      transparent 70%
    );
    animation: pulse 2s ease-in-out infinite;
    pointer-events: none;
  }
  
  /* Typography */
  .app-name {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary, #ffffff);
    margin: 0;
    letter-spacing: 0.05em;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }
  
  /* Loading section */
  .loading-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    min-width: 200px;
  }
  
  /* Progress bar */
  .progress-bar-container {
    width: 200px;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }
  
  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #ff9500, #ff5722);
    border-radius: 2px;
    transition: width 0.3s ease-out;
  }
  
  .progress-text {
    font-size: 0.75rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
  }
  
  /* Spinner */
  .spinner {
    width: 32px;
    height: 32px;
  }
  
  .spinner-ring {
    width: 100%;
    height: 100%;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: #ff9500;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .status-message {
    font-size: 0.875rem;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    margin: 0;
    min-width: 180px;
    text-align: center;
  }
  
  .version {
    font-size: 0.75rem;
    color: var(--text-muted, rgba(255, 255, 255, 0.4));
    position: absolute;
    bottom: 1.5rem;
  }
  
  /* Background */
  .bg-gradient {
    position: absolute;
    inset: 0;
    background: radial-gradient(
      ellipse at 50% 30%,
      rgba(255, 149, 0, 0.08) 0%,
      transparent 50%
    );
    pointer-events: none;
  }
  
  .bg-pattern {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    pointer-events: none;
  }
  
  /* Animations */
  @keyframes float {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-8px);
    }
  }
  
  @keyframes flicker {
    0% {
      opacity: 0.9;
      transform: scale(1);
    }
    100% {
      opacity: 1;
      transform: scale(1.02);
    }
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.1);
    }
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .logo {
      animation: none;
    }
    
    .flame-outer,
    .flame-inner {
      animation: none;
    }
    
    .glow {
      animation: none;
      opacity: 0.5;
    }
    
    .spinner-ring {
      animation: spin 2s linear infinite;
    }
  }
</style>
