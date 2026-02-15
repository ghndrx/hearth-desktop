import { writable } from "svelte/store";
import { browser } from "$app/environment";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toasts } from "./toasts";

export interface MuteState {
  muted: boolean;
}

function createMuteStore() {
  const { subscribe, set, update } = writable<MuteState>({ muted: false });

  async function toggle(): Promise<boolean> {
    if (!browser) return false;

    try {
      const muted = await invoke<boolean>("toggle_mute");
      set({ muted });

      // Show toast notification
      if (muted) {
        toasts.info("Notifications muted");
      } else {
        toasts.success("Notifications unmuted");
      }

      return muted;
    } catch (error) {
      console.error("Failed to toggle mute:", error);
      toasts.error("Failed to toggle mute state");
      return false;
    }
  }

  async function setMuted(muted: boolean): Promise<void> {
    if (!browser) return;

    try {
      await invoke<boolean>("set_mute", { muted });
      set({ muted });
    } catch (error) {
      console.error("Failed to set mute state:", error);
    }
  }

  async function checkState(): Promise<void> {
    if (!browser) return;

    try {
      const muted = await invoke<boolean>("is_muted");
      set({ muted });
    } catch (error) {
      console.error("Failed to check mute state:", error);
    }
  }

  // Listen for mute state changes from the backend (e.g., from global shortcut)
  function setupListener() {
    if (!browser) return;

    listen<{ muted: boolean; message: string }>(
      "mute-state-changed",
      (event) => {
        const { muted, message } = event.payload;
        set({ muted });

        if (muted) {
          toasts.info(message);
        } else {
          toasts.success(message);
        }
      },
    );
  }

  // Initialize
  if (browser) {
    checkState();
    setupListener();
  }

  return {
    subscribe,
    toggle,
    setMuted,
    checkState,
  };
}

export const muteStore = createMuteStore();
