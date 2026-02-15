<script lang="ts">
  export let text: string;
  export let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
  export let delay = 300;
  
  let visible = false;
  let timeout: ReturnType<typeof setTimeout>;
  
  function show() {
    timeout = setTimeout(() => {
      visible = true;
    }, delay);
  }
  
  function hide() {
    clearTimeout(timeout);
    visible = false;
  }
</script>

<div
  class="tooltip-wrapper"
  on:mouseenter={show}
  on:mouseleave={hide}
  on:focus={show}
  on:blur={hide}
  role="tooltip"
>
  <slot />
  
  {#if visible && text}
    <div class="tooltip {position}">
      {text}
      <div class="arrow"></div>
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
  }
  
  .tooltip {
    position: absolute;
    z-index: 1001;
    padding: 8px 12px;
    background-color: var(--bg-floating, #18191c);
    color: var(--text-normal, #dcddde);
    font-size: 14px;
    font-weight: 500;
    border-radius: 5px;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
    white-space: nowrap;
    pointer-events: none;
    animation: tooltipFade 0.1s ease-out;
  }
  
  @keyframes tooltipFade {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  .arrow {
    position: absolute;
    width: 0;
    height: 0;
    border: 5px solid transparent;
  }
  
  /* Positions */
  .top {
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
  }
  
  .top .arrow {
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-top-color: var(--bg-floating, #18191c);
  }
  
  .bottom {
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 8px;
  }
  
  .bottom .arrow {
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-bottom-color: var(--bg-floating, #18191c);
  }
  
  .left {
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-right: 8px;
  }
  
  .left .arrow {
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-left-color: var(--bg-floating, #18191c);
  }
  
  .right {
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    margin-left: 8px;
  }
  
  .right .arrow {
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-right-color: var(--bg-floating, #18191c);
  }
</style>
