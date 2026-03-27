import { invoke } from '@tauri-apps/api/core';
import type { DetectedGame, GameEntry } from './types';

/**
 * Get all currently running games detected on the system
 */
export async function getRunningGames(): Promise<DetectedGame[]> {
  try {
    return await invoke<DetectedGame[]>('get_running_games');
  } catch (error) {
    console.error('Failed to get running games:', error);
    throw new Error(`Failed to get running games: ${error}`);
  }
}

/**
 * Detect the currently active/primary game being played
 */
export async function detectRunningGame(): Promise<DetectedGame | null> {
  try {
    return await invoke<DetectedGame | null>('detect_running_game');
  } catch (error) {
    console.error('Failed to detect running game:', error);
    throw new Error(`Failed to detect running game: ${error}`);
  }
}

/**
 * Get the list of games that the detection engine supports
 */
export async function getSupportedGames(): Promise<GameEntry[]> {
  try {
    return await invoke<GameEntry[]>('get_supported_games');
  } catch (error) {
    console.error('Failed to get supported games:', error);
    throw new Error(`Failed to get supported games: ${error}`);
  }
}

/**
 * Utility function to format game display name with platform
 */
export function formatGameName(game: DetectedGame): string {
  return `${game.name} (${game.platform})`;
}

/**
 * Utility function to check if a game is a communication app (like Discord)
 */
export function isCommunicationApp(game: DetectedGame): boolean {
  const commApps = ['discord', 'teamspeak', 'skype', 'slack'];
  return commApps.includes(game.id.toLowerCase());
}

/**
 * Utility function to get game platform color for UI
 */
export function getGamePlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    Steam: '#1b2838',
    Epic: '#2d69e0',
    Origin: '#ff6600',
    BattleNet: '#0099ff',
    Riot: '#eb0029',
    Standalone: '#666666',
    Unknown: '#999999',
  };
  return colors[platform] || colors.Unknown;
}