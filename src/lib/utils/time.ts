/**
 * Time utilities for message timestamps
 */

/**
 * Format a timestamp for display
 */
export function formatTimestamp(date: Date | string, format: 'short' | 'long' | 'relative' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'relative') {
    return getRelativeTime(d);
  }
  
  const now = new Date();
  const isToday = isSameDay(d, now);
  const isYesterday = isSameDay(d, new Date(now.getTime() - 86400000));
  
  if (format === 'short') {
    if (isToday) {
      return formatTime(d);
    } else if (isYesterday) {
      return `Yesterday at ${formatTime(d)}`;
    } else {
      return formatDate(d);
    }
  }
  
  // Long format
  if (isToday) {
    return `Today at ${formatTime(d)}`;
  } else if (isYesterday) {
    return `Yesterday at ${formatTime(d)}`;
  } else {
    return `${formatDate(d)} at ${formatTime(d)}`;
  }
}

/**
 * Format time as HH:MM AM/PM
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date as MM/DD/YYYY
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);
  
  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  } else if (diffWeek < 4) {
    return `${diffWeek} week${diffWeek === 1 ? '' : 's'} ago`;
  } else if (diffMonth < 12) {
    return `${diffMonth} month${diffMonth === 1 ? '' : 's'} ago`;
  } else {
    return `${diffYear} year${diffYear === 1 ? '' : 's'} ago`;
  }
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Format a duration in milliseconds
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  }
  return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}

/**
 * Format a Discord-style timestamp code
 * F = full date and time
 * f = date and time
 * D = full date
 * d = date
 * T = full time
 * t = time
 * R = relative
 */
export function formatDiscordTimestamp(unix: number, style: 'F' | 'f' | 'D' | 'd' | 'T' | 't' | 'R' = 'f'): string {
  const date = new Date(unix * 1000);
  
  switch (style) {
    case 'R':
      return getRelativeTime(date);
    case 't':
      return formatTime(date);
    case 'T':
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    case 'd':
      return formatDate(date);
    case 'D':
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    case 'f':
      return `${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} ${formatTime(date)}`;
    case 'F':
      return `${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} ${formatTime(date)}`;
    default:
      return formatTimestamp(date);
  }
}

/**
 * Parse a Discord timestamp from message content
 */
export function parseDiscordTimestamp(content: string): string {
  return content.replace(/<t:(\d+)(?::([FfDdTtR]))?>/g, (_, unix, style) => {
    return formatDiscordTimestamp(parseInt(unix, 10), style || 'f');
  });
}

/**
 * Get snowflake creation timestamp (Discord-style IDs)
 */
export function snowflakeToDate(snowflake: string): Date {
  // Discord epoch is 2015-01-01T00:00:00.000Z
  const DISCORD_EPOCH = 1420070400000n;
  const id = BigInt(snowflake);
  const timestamp = Number((id >> 22n) + DISCORD_EPOCH);
  return new Date(timestamp);
}
