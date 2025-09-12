import { invoke } from '@tauri-apps/api/core';

// Stats interfaces (matching Rust backend types)
export interface ProblemsWorkedTodayResponse {
  count: number;
  date: string; // ISO date string (YYYY-MM-DD)
}

export interface DailyWorkStats {
  problems_worked: number;
  total_study_time_today: number; // in seconds
  date: string; // ISO date string (YYYY-MM-DD)
}

export interface DashboardStats {
  total_problems: number;
  total_study_time: number; // in seconds
  problems_worked_today: number;
  completed_problems: number;
}

/**
 * Service class for handling statistics-related API calls
 */
export class StatsService {
  private static cache = new Map<string, { data: any; timestamp: number }>();
  private static readonly CACHE_DURATION = 60000; // 1 minute cache

  /**
   * Get the number of problems worked on today
   */
  static async getProblemsWorkedToday(): Promise<ProblemsWorkedTodayResponse> {
    const cacheKey = 'problems-worked-today';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const result = await invoke<ProblemsWorkedTodayResponse>('get_problems_worked_today');
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Failed to fetch problems worked today:', error);
      throw new Error(`Failed to fetch problems worked today: ${error}`);
    }
  }

  /**
   * Get comprehensive daily work statistics
   */
  static async getDailyWorkStats(): Promise<DailyWorkStats> {
    const cacheKey = 'daily-work-stats';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const result = await invoke<DailyWorkStats>('get_daily_work_stats');
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Failed to fetch daily work stats:', error);
      throw new Error(`Failed to fetch daily work stats: ${error}`);
    }
  }

  /**
   * Get comprehensive dashboard statistics
   */
  static async getDashboardStats(): Promise<DashboardStats> {
    const cacheKey = 'dashboard-stats';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const result = await invoke<DashboardStats>('get_dashboard_stats');
      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      throw new Error(`Failed to fetch dashboard stats: ${error}`);
    }
  }

  /**
   * Clear the cache (useful when data changes)
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for specific key
   */
  static clearCacheForKey(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Get item from cache if still valid
   */
  private static getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }

    const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set item in cache with timestamp
   */
  private static setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Check if it's a new day since the cache was created
   * If so, clear the cache to get fresh daily stats
   */
  static checkAndClearExpiredDailyCache(): void {
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Check if any cached stats are from a different day
    for (const [key, cached] of this.cache.entries()) {
      if (key.includes('today') || key.includes('daily')) {
        const cachedDate = new Date(cached.timestamp);
        const cachedDay = cachedDate.toISOString().split('T')[0];
        
        if (cachedDay !== today) {
          this.cache.delete(key);
        }
      }
    }
  }
}

// Helper function to format time for display
export const formatTimeDisplay = (seconds: number): string => {
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
};