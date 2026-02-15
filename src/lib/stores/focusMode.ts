import { writable } from "svelte/store";
import { browser } from "$app/environment";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toasts } from "./toasts";

export interface FocusModeState {
  active: boolean;
}

function createFocusModeStore() {
  const { subscribe, set, update } = writable<FocusModeState>({
    active: false,
  });

  async function toggle(): Promise<boolean> {
    if (!browser) return false;

    try {
      const active = await invoke<boolean>("toggle_focus_mode");
      set({ active });

      // Show toast notification
      if (active) {
        toasts.info("Focus mode enabled - only mentions and DMs");
      } else {
        toasts.success("Focus mode disabled");
      }

      return active;
    } catch (error) {
      console.error("Failed to toggle focus mode:", error);
      toasts.error("Failed to toggle focus mode");
      return false;
    }
  }

  async function setFocusMode(active: boolean): Promise<void> {
    if (!browser) return;

    try {
      await invoke<boolean>("set_focus_mode", { active });
      set({ active });

      if (active) {
        toasts.info("Focus mode enabled - only mentions and DMs");
      } else {
        toasts.success("Focus mode disabled");
      }
    } catch (error) {
      console.error("Failed to set focus mode:", error);
    }
  }

  async function checkState(): Promise<void> {
    if (!browser) return;

    try {
      const active = await invoke<boolean>("is_focus_mode_active");
      set({ active });
    } catch (error) {
      console.error("Failed to check focus mode state:", error);
    }
  }

  // Listen for focus mode state changes from the backend (e.g., from global shortcut)
  function setupListener() {
    if (!browser) return;

    listen<{ active: boolean; message: string }>(
      "focus-mode-changed",
      (event) => {
        const { active, message } = event.payload;
        set({ active });

        if (active) {
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
    setFocusMode,
    checkState,
  };
}

export const focusModeStore = createFocusModeStore();
