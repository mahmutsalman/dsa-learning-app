/**
 * Time utility functions for formatting durations
 */

/**
 * Format duration in seconds to hour and minute format
 * Examples:
 * - 0 seconds -> "0m"
 * - 59 seconds -> "59s" 
 * - 60 seconds -> "1m"
 * - 3661 seconds -> "1h 1m"
 * - 7200 seconds -> "2h"
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) {
    return "0m";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`);
  } else if (hours > 0) {
    // If we have hours but no minutes, still show 0m for clarity unless there are remaining seconds
    if (remainingSeconds === 0) {
      // Don't add minutes if we have exact hours
    } else {
      parts.push("0m");
    }
  }

  // Only show seconds if we don't have hours and minutes are less than 1
  if (hours === 0 && minutes === 0 && remainingSeconds > 0) {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.join(" ") || "0m";
}

/**
 * Format duration in seconds to a more verbose format
 * Examples:
 * - 0 seconds -> "0 minutes"
 * - 59 seconds -> "59 seconds"
 * - 60 seconds -> "1 minute"
 * - 3661 seconds -> "1 hour, 1 minute"
 */
export function formatDurationVerbose(seconds: number): string {
  if (seconds <= 0) {
    return "0 minutes";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  }

  if (hours === 0 && minutes === 0 && remainingSeconds > 0) {
    parts.push(`${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return "0 minutes";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length === 2) {
    return parts.join(", ");
  }

  return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
}

/**
 * Format duration for compact display (similar to existing Dashboard format)
 * Examples:
 * - 0 seconds -> "0h"
 * - 59 seconds -> "59s"
 * - 3661 seconds -> "1h 1m"
 */
export function formatDurationCompact(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else if (seconds > 0) {
    return `${seconds}s`;
  } else {
    return '0h';
  }
}

/**
 * Format duration in HH:MM:SS format (always shows hours even if 0)
 * Examples:
 * - 0 seconds -> "00:00:00"
 * - 59 seconds -> "00:00:59"
 * - 65 seconds -> "00:01:05"  
 * - 3661 seconds -> "01:01:01"
 * - 36000 seconds -> "10:00:00"
 */
export function formatDurationHHMMSS(seconds: number): string {
  if (seconds < 0) {
    seconds = 0;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  // Pad with leading zeros
  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const secondsStr = remainingSeconds.toString().padStart(2, '0');

  return `${hoursStr}:${minutesStr}:${secondsStr}`;
}