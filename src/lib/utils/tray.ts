import { invoke } from "@tauri-apps/api/core";
import { browser } from "$app/environment";

/**
 * Update the tray icon badge with unread message count
 * @param count - Number of unread messages
 */
export async function updateTrayBadge(count: number): Promise<void> {
  if (!browser) return;

  try {
    await invoke("update_tray_badge", { count });
  } catch (error) {
    console.error("Failed to update tray badge:", error);
  }
}

/**
 * Get the current tray badge count
 * @returns Current unread count
 */
export async function getTrayBadge(): Promise<number> {
  if (!browser) return 0;

  try {
    return await invoke("get_tray_badge");
  } catch (error) {
    console.error("Failed to get tray badge:", error);
    return 0;
  }
}

/**
 * Clear the tray badge (set to 0)
 */
export async function clearTrayBadge(): Promise<void> {
  await updateTrayBadge(0);
}
