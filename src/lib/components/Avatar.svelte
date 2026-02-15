<script lang="ts">
  import PresenceIndicator from './PresenceIndicator.svelte';
  
  export let src: string | null = null;
  export let alt = 'Avatar';
  export let size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let userId: string | null = null;
  export let showPresence = false;
  export let username: string | null = null;
  
  const sizes = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 80,
    xl: 128,
  };
  
  const presenceSizes = {
    xs: 'sm' as const,
    sm: 'sm' as const,
    md: 'md' as const,
    lg: 'lg' as const,
    xl: 'lg' as const,
  };
  
  $: sizeValue = sizes[size];
  $: presenceSize = presenceSizes[size];
  
  // Generate color from username for fallback
  function getColorFromString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      '#7289da', '#3498db', '#1abc9c', '#2ecc71', '#f1c40f',
      '#e67e22', '#e74c3c', '#9b59b6', '#e91e63', '#607d8b'
    ];
    return colors[Math.abs(hash) % colors.length];
  }
  
  $: fallbackColor = username ? getColorFromString(username) : '#7289da';
  $: initials = username ? username.slice(0, 2).toUpperCase() : '?';
</script>

<div
  class="avatar-wrapper"
  class:xs={size === 'xs'}
  class:sm={size === 'sm'}
  class:md={size === 'md'}
  class:lg={size === 'lg'}
  class:xl={size === 'xl'}
  style="--size: {sizeValue}px;"
>
  {#if src}
    <img
      class="avatar"
      {src}
      {alt}
      width={sizeValue}
      height={sizeValue}
      loading="lazy"
    />
  {:else}
    <div
      class="avatar fallback"
      style="background-color: {fallbackColor};"
    >
      <span class="initials">{initials}</span>
    </div>
  {/if}
  
  {#if showPresence && userId}
    <div class="presence-wrapper">
      <PresenceIndicator {userId} size={presenceSize} />
    </div>
  {/if}
</div>

<style>
  .avatar-wrapper {
    position: relative;
    width: var(--size);
    height: var(--size);
    flex-shrink: 0;
  }
  
  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
  
  .fallback {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .initials {
    color: white;
    font-weight: 600;
    font-size: calc(var(--size) * 0.4);
    text-transform: uppercase;
    user-select: none;
  }
  
  .presence-wrapper {
    position: absolute;
    bottom: -2px;
    right: -2px;
  }
  
  .xl .presence-wrapper {
    bottom: 4px;
    right: 4px;
  }
  
  .lg .presence-wrapper {
    bottom: 0;
    right: 0;
  }
</style>
