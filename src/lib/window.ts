/**
 * Window management utilities using Tauri commands.
 */

declare global {
  interface Window {
    __TAURI__: {
      core: {
        invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      };
    };
  }
}

/**
 * Set a window's always-on-top (pin) state.
 * @param windowLabel - The label of the target window
 * @param alwaysOnTop - Whether to pin the window above others
 */
export async function setAlwaysOnTop(
  windowLabel: string,
  alwaysOnTop: boolean
): Promise<void> {
  await window.__TAURI__.core.invoke('set_always_on_top', {
    window_label: windowLabel,
    always_on_top: alwaysOnTop,
  });
}
