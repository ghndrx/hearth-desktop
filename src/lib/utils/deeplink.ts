/**
 * Deep link utilities for generating hearth:// URLs
 * 
 * These URLs can be shared externally and will open the Hearth desktop app
 * when clicked, navigating directly to the specified resource.
 */

const PROTOCOL = 'hearth';

/**
 * Generate a deep link URL for a DM conversation with a user
 * @param userId - The user ID to open a chat with
 */
export function createChatLink(userId: string): string {
  return `${PROTOCOL}://chat/${encodeURIComponent(userId)}`;
}

/**
 * Generate a deep link URL for a channel
 * @param channelId - The channel ID to navigate to
 */
export function createChannelLink(channelId: string): string {
  return `${PROTOCOL}://channel/${encodeURIComponent(channelId)}`;
}

/**
 * Generate a deep link URL for a server
 * @param serverId - The server ID to navigate to
 * @param channelId - Optional channel ID within the server
 */
export function createServerLink(serverId: string, channelId?: string): string {
  if (channelId) {
    return `${PROTOCOL}://server/${encodeURIComponent(serverId)}/${encodeURIComponent(channelId)}`;
  }
  return `${PROTOCOL}://server/${encodeURIComponent(serverId)}`;
}

/**
 * Generate a deep link URL for an invite
 * @param inviteCode - The invite code
 * @param serverId - Optional server ID for context
 * @param referrer - Optional referrer parameter for tracking
 */
export function createInviteLink(
  inviteCode: string, 
  options?: { serverId?: string; referrer?: string }
): string {
  const params = new URLSearchParams();
  
  if (options?.serverId) {
    params.set('server', options.serverId);
  }
  if (options?.referrer) {
    params.set('ref', options.referrer);
  }
  
  const queryString = params.toString();
  const base = `${PROTOCOL}://invite/${encodeURIComponent(inviteCode)}`;
  
  return queryString ? `${base}?${queryString}` : base;
}

/**
 * Generate a deep link URL for settings
 * @param section - Optional settings section (notifications, appearance, etc.)
 */
export function createSettingsLink(section?: string): string {
  if (section) {
    return `${PROTOCOL}://settings/${encodeURIComponent(section)}`;
  }
  return `${PROTOCOL}://settings`;
}

/**
 * Generate a deep link URL for joining a voice call
 * @param callId - The call/voice channel ID to join
 */
export function createCallLink(callId: string): string {
  return `${PROTOCOL}://call/${encodeURIComponent(callId)}`;
}

/**
 * Parse a deep link URL and extract its components
 * @param url - The hearth:// URL to parse
 * @returns Parsed components or null if invalid
 */
export function parseDeepLink(url: string): {
  action: string;
  target: string | null;
  params: Record<string, string>;
} | null {
  const trimmed = url.trim();
  
  if (!trimmed.startsWith(`${PROTOCOL}://`)) {
    return null;
  }
  
  const withoutProtocol = trimmed.slice(PROTOCOL.length + 3); // Remove "hearth://"
  const [pathPart, queryPart] = withoutProtocol.split('?');
  
  // Parse query params
  const params: Record<string, string> = {};
  if (queryPart) {
    const searchParams = new URLSearchParams(queryPart);
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  }
  
  // Parse path segments
  const segments = pathPart.split('/').filter(s => s.length > 0);
  
  if (segments.length === 0) {
    return null;
  }
  
  const action = decodeURIComponent(segments[0]);
  const target = segments[1] ? decodeURIComponent(segments[1]) : null;
  
  // Handle server/:serverId/:channelId case
  if (action === 'server' && segments.length >= 3) {
    params['channel'] = decodeURIComponent(segments[2]);
  }
  
  return { action, target, params };
}

/**
 * Check if a URL is a valid Hearth deep link
 * @param url - The URL to check
 */
export function isDeepLink(url: string): boolean {
  return url.trim().startsWith(`${PROTOCOL}://`);
}
