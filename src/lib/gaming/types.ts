export interface DetectedGame {
  id: string;
  name: string;
  executable: string;
  window_title?: string;
  platform: GamePlatform;
  pid: number;
  start_time?: number;
}

export enum GamePlatform {
  Steam = "Steam",
  Epic = "Epic",
  Origin = "Origin",
  BattleNet = "BattleNet",
  Riot = "Riot",
  Standalone = "Standalone",
  Unknown = "Unknown"
}

export interface GameEntry {
  id: string;
  name: string;
  executables: string[];
  platform: GamePlatform;
}

export interface RichPresence {
  state?: string;        // "In Match"
  details?: string;      // "Ranked Solo/Duo"
  startTimestamp?: number;
  endTimestamp?: number;
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
  partyId?: string;
  partySize?: number;
  partyMax?: number;
}

export interface GameActivity {
  type: "playing" | "streaming" | "listening" | "watching" | "competing";
  name: string;
  presence?: RichPresence;
}