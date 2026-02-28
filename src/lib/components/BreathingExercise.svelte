<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';

  const dispatch = createEventDispatcher();

  // Breathing patterns (in seconds)
  const PATTERNS = {
    relaxing: { name: 'Relaxing', inhale: 4, hold: 7, exhale: 8, description: '4-7-8 technique for relaxation' },
    balanced: { name: 'Balanced', inhale: 4, hold: 4, exhale: 4, description: 'Box breathing for focus' },
    energizing: { name: 'Energizing', inhale: 6, hold: 0, exhale: 2, description: 'Quick breaths for energy' },
    calming: { name: 'Calming', inhale: 5, hold: 2, exhale: 7, description: 'Extended exhale for calm' },
  } as const;

  type PatternKey = keyof typeof PATTERNS;

  export let isOpen = false;
  export let defaultPattern: PatternKey = 'balanced';
  export let sessionMinutes = 3;

  let selectedPattern: PatternKey = defaultPattern;
  let isSessionActive = false;
  let isPaused = false;
  let currentPhase: 'inhale' | 'hold' | 'exhale' = 'inhale';
  let phaseProgress = 0;
  let cyclesCompleted = 0;
  let sessionTimeRemaining = 0;
  let circleScale = 1;
  
  let animationFrame: number | null = null;
  let lastTimestamp = 0;
  let phaseStartTime = 0;
  let sessionTimer: ReturnType<typeof setInterval> | null = null;

  $: pattern = PATTERNS[selectedPattern];
  $: totalCycleTime = pattern.inhale + pattern.hold + pattern.exhale;
  $: phaseInstruction = getPhaseInstruction(currentPhase);
  $: formattedTime = formatTime(sessionTimeRemaining);

  function getPhaseInstruction(phase: 'inhale' | 'hold' | 'exhale'): string {
    switch (phase) {
      case 'inhale': return 'Breathe In';
      case 'hold': return pattern.hold > 0 ? 'Hold' : '';
      case 'exhale': return 'Breathe Out';
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function startSession() {
    isSessionActive = true;
    isPaused = false;
    cyclesCompleted = 0;
    sessionTimeRemaining = sessionMinutes * 60;
    currentPhase = 'inhale';
    phaseProgress = 0;
    phaseStartTime = performance.now();
    lastTimestamp = performance.now();

    // Start the animation loop
    animationFrame = requestAnimationFrame(animate);

    // Start session countdown
    sessionTimer = setInterval(() => {
      if (!isPaused && sessionTimeRemaining > 0) {
        sessionTimeRemaining--;
        if (sessionTimeRemaining === 0) {
          endSession();
        }
      }
    }, 1000);

    dispatch('sessionStart', { pattern: selectedPattern, duration: sessionMinutes });
  }

  function animate(timestamp: number) {
    if (!isSessionActive || isPaused) {
      animationFrame = requestAnimationFrame(animate);
      return;
    }

    const elapsed = (timestamp - phaseStartTime) / 1000;
    const phaseDuration = getPhaseDuration(currentPhase);

    if (elapsed >= phaseDuration) {
      // Move to next phase
      advancePhase();
      phaseStartTime = timestamp;
      phaseProgress = 0;
    } else {
      phaseProgress = elapsed / phaseDuration;
      updateCircleScale();
    }

    animationFrame = requestAnimationFrame(animate);
  }

  function getPhaseDuration(phase: 'inhale' | 'hold' | 'exhale'): number {
    switch (phase) {
      case 'inhale': return pattern.inhale;
      case 'hold': return pattern.hold;
      case 'exhale': return pattern.exhale;
    }
  }

  function advancePhase() {
    switch (currentPhase) {
      case 'inhale':
        if (pattern.hold > 0) {
          currentPhase = 'hold';
        } else {
          currentPhase = 'exhale';
        }
        break;
      case 'hold':
        currentPhase = 'exhale';
        break;
      case 'exhale':
        currentPhase = 'inhale';
        cyclesCompleted++;
        dispatch('cycleComplete', { cycles: cyclesCompleted });
        break;
    }
  }

  function updateCircleScale() {
    const minScale = 0.6;
    const maxScale = 1.2;
    const range = maxScale - minScale;

    switch (currentPhase) {
      case 'inhale':
        // Grow from min to max
        circleScale = minScale + (range * phaseProgress);
        break;
      case 'hold':
        // Stay at max
        circleScale = maxScale;
        break;
      case 'exhale':
        // Shrink from max to min
        circleScale = maxScale - (range * phaseProgress);
        break;
    }
  }

  function togglePause() {
    isPaused = !isPaused;
    if (!isPaused) {
      phaseStartTime = performance.now() - (phaseProgress * getPhaseDuration(currentPhase) * 1000);
    }
  }

  function endSession() {
    isSessionActive = false;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    if (sessionTimer) {
      clearInterval(sessionTimer);
      sessionTimer = null;
    }
    dispatch('sessionEnd', { 
      cycles: cyclesCompleted, 
      pattern: selectedPattern,
      duration: sessionMinutes 
    });
  }

  function close() {
    if (isSessionActive) {
      endSession();
    }
    isOpen = false;
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;
    
    if (event.key === 'Escape') {
      close();
    } else if (event.key === ' ' && isSessionActive) {
      event.preventDefault();
      togglePause();
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    if (sessionTimer) {
      clearInterval(sessionTimer);
    }
  });
</script>

{#if isOpen}
  <div 
    class="breathing-overlay" 
    transition:fade={{ duration: 200 }}
    on:click|self={close}
    role="dialog"
    aria-modal="true"
    aria-label="Breathing Exercise"
  >
    <div class="breathing-modal" transition:scale={{ duration: 200, easing: cubicInOut }}>
      <header class="modal-header">
        <h2>🌬️ Breathing Exercise</h2>
        <button class="close-btn" on:click={close} aria-label="Close">
          ✕
        </button>
      </header>

      {#if !isSessionActive}
        <!-- Setup Screen -->
        <div class="setup-screen">
          <div class="pattern-selector">
            <label for="pattern-select">Choose a pattern:</label>
            <select id="pattern-select" bind:value={selectedPattern}>
              {#each Object.entries(PATTERNS) as [key, p]}
                <option value={key}>{p.name}</option>
              {/each}
            </select>
            <p class="pattern-description">{pattern.description}</p>
            <div class="pattern-timing">
              <span>Inhale: {pattern.inhale}s</span>
              {#if pattern.hold > 0}
                <span>Hold: {pattern.hold}s</span>
              {/if}
              <span>Exhale: {pattern.exhale}s</span>
            </div>
          </div>

          <div class="duration-selector">
            <label for="duration-select">Session duration:</label>
            <div class="duration-buttons">
              {#each [1, 3, 5, 10] as minutes}
                <button 
                  class="duration-btn" 
                  class:active={sessionMinutes === minutes}
                  on:click={() => sessionMinutes = minutes}
                >
                  {minutes} min
                </button>
              {/each}
            </div>
          </div>

          <button class="start-btn" on:click={startSession}>
            Begin Session
          </button>
        </div>
      {:else}
        <!-- Active Session Screen -->
        <div class="session-screen">
          <div class="session-info">
            <span class="time-remaining">{formattedTime}</span>
            <span class="cycles-count">{cyclesCompleted} cycles</span>
          </div>

          <div class="breathing-circle-container">
            <div 
              class="breathing-circle"
              class:inhale={currentPhase === 'inhale'}
              class:hold={currentPhase === 'hold'}
              class:exhale={currentPhase === 'exhale'}
              style="transform: scale({circleScale})"
            >
              <div class="inner-circle">
                <span class="phase-text">{phaseInstruction}</span>
              </div>
            </div>
            <div class="progress-ring">
              <svg viewBox="0 0 100 100">
                <circle 
                  class="progress-track" 
                  cx="50" cy="50" r="45" 
                />
                <circle 
                  class="progress-fill" 
                  cx="50" cy="50" r="45"
                  style="stroke-dashoffset: {283 - (283 * phaseProgress)}"
                />
              </svg>
            </div>
          </div>

          <div class="session-controls">
            <button class="control-btn" on:click={togglePause}>
              {isPaused ? '▶️ Resume' : '⏸️ Pause'}
            </button>
            <button class="control-btn end-btn" on:click={endSession}>
              ⏹️ End
            </button>
          </div>

          <p class="hint">Press Space to pause/resume, Esc to close</p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .breathing-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .breathing-modal {
    background: var(--bg-primary, #1a1a2e);
    border-radius: 16px;
    padding: 24px;
    min-width: 380px;
    max-width: 420px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    color: var(--text-primary, #e0e0e0);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    font-size: 1.2rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .close-btn:hover {
    background: var(--bg-hover, rgba(255,255,255,0.1));
  }

  /* Setup Screen */
  .setup-screen {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .pattern-selector label,
  .duration-selector label {
    display: block;
    font-size: 0.9rem;
    color: var(--text-secondary, #888);
    margin-bottom: 8px;
  }

  .pattern-selector select {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border-color, #333);
    background: var(--bg-secondary, #252540);
    color: var(--text-primary, #e0e0e0);
    font-size: 1rem;
    cursor: pointer;
  }

  .pattern-description {
    font-size: 0.85rem;
    color: var(--text-secondary, #888);
    margin: 8px 0 4px;
  }

  .pattern-timing {
    display: flex;
    gap: 16px;
    font-size: 0.8rem;
    color: var(--text-muted, #666);
  }

  .duration-buttons {
    display: flex;
    gap: 8px;
  }

  .duration-btn {
    flex: 1;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid var(--border-color, #333);
    background: var(--bg-secondary, #252540);
    color: var(--text-primary, #e0e0e0);
    cursor: pointer;
    transition: all 0.2s;
  }

  .duration-btn:hover {
    border-color: var(--accent-color, #6366f1);
  }

  .duration-btn.active {
    background: var(--accent-color, #6366f1);
    border-color: var(--accent-color, #6366f1);
    color: white;
  }

  .start-btn {
    padding: 14px 24px;
    border-radius: 10px;
    border: none;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .start-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4);
  }

  /* Session Screen */
  .session-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }

  .session-info {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 0 20px;
  }

  .time-remaining {
    font-size: 1.5rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .cycles-count {
    color: var(--text-secondary, #888);
  }

  .breathing-circle-container {
    position: relative;
    width: 200px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .breathing-circle {
    width: 160px;
    height: 160px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.1s linear;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0.1) 70%);
  }

  .breathing-circle.inhale {
    background: radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.1) 70%);
  }

  .breathing-circle.hold {
    background: radial-gradient(circle, rgba(234, 179, 8, 0.3) 0%, rgba(234, 179, 8, 0.1) 70%);
  }

  .breathing-circle.exhale {
    background: radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, rgba(99, 102, 241, 0.1) 70%);
  }

  .inner-circle {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: var(--bg-primary, #1a1a2e);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .phase-text {
    font-size: 1rem;
    font-weight: 500;
    text-align: center;
  }

  .progress-ring {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .progress-ring svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .progress-track {
    fill: none;
    stroke: var(--border-color, #333);
    stroke-width: 2;
  }

  .progress-fill {
    fill: none;
    stroke: var(--accent-color, #6366f1);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-dasharray: 283;
    transition: stroke-dashoffset 0.1s linear;
  }

  .session-controls {
    display: flex;
    gap: 12px;
  }

  .control-btn {
    padding: 10px 20px;
    border-radius: 8px;
    border: 1px solid var(--border-color, #333);
    background: var(--bg-secondary, #252540);
    color: var(--text-primary, #e0e0e0);
    cursor: pointer;
    transition: all 0.2s;
  }

  .control-btn:hover {
    border-color: var(--accent-color, #6366f1);
  }

  .end-btn:hover {
    border-color: #ef4444;
    color: #ef4444;
  }

  .hint {
    font-size: 0.75rem;
    color: var(--text-muted, #666);
    margin: 0;
  }
</style>
