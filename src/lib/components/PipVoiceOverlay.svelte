<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import {
    voiceParticipants,
    hasParticipants,
    isVoiceConnected,
    currentVoiceChannel
  } from '$lib/stores/voice';
  import type { VoiceParticipant } from '$lib/voice/types';

  // Close the PiP window
  async function closePip() {
    try {
      await invoke('close_pip_window');
    } catch (error) {
      console.error('Failed to close PiP window:', error);
    }
  }

  // Generate avatar fallback initials
  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  // Generate consistent color for user
  function getUserColor(userId: string): string {
    const colors = [
      '#F87171', '#FB923C', '#FBBF24', '#A3E635',
      '#34D399', '#22D3EE', '#60A5FA', '#A78BFA',
      '#F472B6', '#FB7185'
    ];
    const hash = userId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }

  // Drag functionality
  async function handleMouseDown(event: MouseEvent) {
    // Don't drag if clicking on the close button
    if ((event.target as HTMLElement).closest('.close-button')) return;

    try {
      await getCurrentWindow().startDragging();
    } catch (error) {
      console.error('Failed to start dragging:', error);
    }
  }

  // Optional: You can add any initialization logic here if needed
  // onMount(() => {
  //   // Window initialization
  // });
</script>

<div
  class="pip-container"
  on:mousedown={handleMouseDown}
  role="application"
  aria-label="Voice Channel Picture-in-Picture"
>
  <!-- Header with close button -->
  <div class="header">
    <div class="title">
      {#if $isVoiceConnected}
        Voice Channel
      {:else}
        Not Connected
      {/if}
    </div>
    <button
      class="close-button"
      on:click={closePip}
      aria-label="Close voice overlay"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M1 1L13 13M1 13L13 1"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>

  <!-- Content area -->
  <div class="content">
    {#if !$isVoiceConnected}
      <!-- No channel state -->
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 15.5C13.933 15.5 15.5 13.933 15.5 12V6C15.5 4.067 13.933 2.5 12 2.5S8.5 4.067 8.5 6V12C8.5 13.933 10.067 15.5 12 15.5Z"
              stroke="currentColor"
              stroke-width="2"
            />
            <path d="M19 12V13C19 17.4183 15.4183 21 11 21H8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M5 12V13C5 17.4183 8.58172 21 13 21H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M12 21V23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M8 23H16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="empty-text">Join a voice channel to see participants</div>
      </div>
    {:else if !$hasParticipants}
      <!-- Connected but no participants -->
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M8 14S9.5 16 12 16S16 14 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M9 9H9.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M15 9H15.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="empty-text">You're alone in this channel</div>
      </div>
    {:else}
      <!-- Participants grid -->
      <div class="participants">
        {#each $voiceParticipants as participant (participant.userId)}
          <div
            class="participant"
            class:speaking={participant.isSpeaking}
            class:muted={participant.isMuted}
          >
            <div class="avatar">
              {#if participant.avatarUrl}
                <img
                  src={participant.avatarUrl}
                  alt={participant.displayName || participant.username}
                  loading="lazy"
                />
              {:else}
                <div
                  class="avatar-fallback"
                  style="background-color: {getUserColor(participant.userId)}"
                >
                  {getInitials(participant.displayName || participant.username)}
                </div>
              {/if}

              <!-- Speaking indicator -->
              {#if participant.isSpeaking}
                <div class="speaking-indicator"></div>
              {/if}

              <!-- Muted indicator -->
              {#if participant.isMuted}
                <div class="muted-indicator">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 3L21 21M9 9V10.5C9 11.8807 10.1193 13 11.5 13C11.8395 13 12.1734 12.9511 12.4899 12.8598M15 12V10.5C15 7.46243 12.5376 5 9.5 5C8.25611 5 7.10395 5.49666 6.23682 6.29732M19 12V13.5C19 18.1944 15.1944 22 10.5 22C9.34315 22 8.24999 21.7416 7.26634 21.281"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </div>
              {/if}
            </div>

            <div class="username">
              {participant.displayName || participant.username}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .pip-container {
    width: 100%;
    height: 100%;
    background: rgba(30, 30, 35, 0.95);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    cursor: move;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .title {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
  }

  .close-button {
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .content {
    padding: 12px;
    height: calc(100% - 44px);
    overflow-y: auto;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    gap: 8px;
  }

  .empty-icon {
    color: rgba(255, 255, 255, 0.4);
  }

  .empty-text {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.3;
  }

  .participants {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: 8px;
    align-items: start;
  }

  .participant {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    position: relative;
    overflow: hidden;
    transition: all 0.2s ease;
    border: 2px solid transparent;
  }

  .participant.speaking .avatar {
    border-color: #22c55e;
    box-shadow: 0 0 12px rgba(34, 197, 94, 0.4);
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    color: white;
  }

  .speaking-indicator {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 12px;
    height: 12px;
    background: #22c55e;
    border-radius: 50%;
    border: 2px solid rgba(30, 30, 35, 0.95);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .muted-indicator {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
    background: #ef4444;
    border-radius: 50%;
    border: 2px solid rgba(30, 30, 35, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .username {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
    max-width: 60px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
    }
    70% {
      box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
    }
  }

  /* Scrollbar styling */
  .content::-webkit-scrollbar {
    width: 4px;
  }

  .content::-webkit-scrollbar-track {
    background: transparent;
  }

  .content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
  }
</style>