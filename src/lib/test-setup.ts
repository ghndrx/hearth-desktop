import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Svelte transitions to be instant in tests
// This prevents elements from being held in DOM during transition animations
vi.mock('svelte/transition', () => ({
  fade: () => ({ duration: 0 }),
  fly: () => ({ duration: 0 }),
  slide: () => ({ duration: 0 }),
  scale: () => ({ duration: 0 }),
  blur: () => ({ duration: 0 }),
  draw: () => ({ duration: 0 }),
  crossfade: () => [() => ({ duration: 0 }), () => ({ duration: 0 })]
}));

// Polyfill for Web Animations API (not supported in jsdom)
// This is needed for Svelte 5 transitions
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = function(keyframes: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
    // Create a deferred animation mock that properly types the Promise properties
    const animationPromise = Promise.resolve() as unknown as Promise<Animation>;
    const animation = {
      finished: animationPromise,
      cancel: vi.fn(),
      finish: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(),
      reverse: vi.fn(),
      updatePlaybackRate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
      currentTime: 0,
      playbackRate: 1,
      playState: 'finished' as AnimationPlayState,
      pending: false,
      id: '',
      oncancel: null,
      onfinish: null,
      onremove: null,
      timeline: null,
      startTime: null,
      effect: null,
      replaceState: 'active' as AnimationReplaceState,
      persist: vi.fn(),
      commitStyles: vi.fn(),
      ready: animationPromise,
    } as unknown as Animation;
    return animation;
  };
}

// Mock SvelteKit's $app modules
vi.mock('$app/environment', () => ({
  browser: true,
  dev: true,
  building: false,
  version: 'test'
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  beforeNavigate: vi.fn(),
  afterNavigate: vi.fn()
}));

vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn((fn) => {
      fn({ url: new URL('http://localhost'), params: {} });
      return () => {};
    })
  },
  navigating: {
    subscribe: vi.fn((fn) => {
      fn(null);
      return () => {};
    })
  }
}));

// Mock $lib imports
vi.mock('$lib/stores/channels', () => ({
  channels: {
    subscribe: vi.fn((fn) => {
      fn([]);
      return () => {};
    })
  },
  currentChannel: {
    subscribe: vi.fn((fn) => {
      fn(null);
      return () => {};
    }),
    set: vi.fn()
  }
}));

vi.mock('$lib/stores/servers', () => ({
  currentServer: {
    subscribe: vi.fn((fn) => {
      fn(null);
      return () => {};
    }),
    set: vi.fn()
  },
  leaveServer: vi.fn()
}));

vi.mock('$lib/stores/auth', () => ({
  user: {
    subscribe: vi.fn((fn) => {
      fn(null);
      return () => {};
    })
  }
}));

vi.mock('$lib/stores/settings', () => ({
  settings: {
    openServerSettings: vi.fn()
  }
}));
