import { invoke } from '@tauri-apps/api/core';

export interface WorkSessionStats {
  total_duration_seconds: number;
  unique_problems_count: number;
  total_sessions_count: number;
}

export interface WorkSessionsDateRangeRequest {
  start_date: string; // YYYY-MM-DD format
  end_date: string;   // YYYY-MM-DD format
}

/**
 * Service class for work session analytics API calls
 */
export class WorkSessionService {
  private static cache = new Map<string, { data: any; expires: number }>();
  private static readonly CACHE_DURATION = 60000; // 1 minute cache

  /**
   * Clear expired cache entries
   */
  private static clearExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cached result or execute the API call
   */
  private static async getCachedResult<T>(
    cacheKey: string,
    apiCall: () => Promise<T>,
    cacheDuration: number = this.CACHE_DURATION
  ): Promise<T> {
    this.clearExpiredCache();
    
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return cached.data as T;
    }
    
    const result = await apiCall();
    this.cache.set(cacheKey, {
      data: result,
      expires: Date.now() + cacheDuration
    });
    
    return result;
  }

  /**
   * Get yesterday's work session statistics
   */
  static async getYesterdayStats(): Promise<WorkSessionStats> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const cacheKey = `yesterday-stats-${yesterdayStr}`;
    
    return this.getCachedResult(cacheKey, async () => {
      const summaries = await invoke<Array<{
        date: string;
        total_duration_seconds: number;
        unique_problems_count: number;
        total_sessions_count: number;
      }>>('get_daily_aggregates', {
        request: {
          start_date: yesterdayStr,
          end_date: yesterdayStr
        }
      });

      // If no data for yesterday, return zero stats
      if (!summaries || summaries.length === 0) {
        return {
          total_duration_seconds: 0,
          unique_problems_count: 0,
          total_sessions_count: 0
        };
      }

      return summaries[0];
    });
  }

  /**
   * Get last 7 days work session statistics
   */
  static async getLast7DaysStats(): Promise<WorkSessionStats> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 6); // Last 7 days including today
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const cacheKey = `last-7-days-stats-${endDateStr}`;
    
    return this.getCachedResult(cacheKey, async () => {
      const dailySummaries = await invoke<Array<{
        date: string;
        total_duration_seconds: number;
        unique_problems_count: number;
        total_sessions_count: number;
      }>>('get_daily_aggregates', {
        request: {
          start_date: startDateStr,
          end_date: endDateStr
        }
      });

      // Aggregate the results
      return dailySummaries.reduce((total, day) => ({
        total_duration_seconds: total.total_duration_seconds + day.total_duration_seconds,
        unique_problems_count: total.unique_problems_count + day.unique_problems_count,
        total_sessions_count: total.total_sessions_count + day.total_sessions_count
      }), {
        total_duration_seconds: 0,
        unique_problems_count: 0,
        total_sessions_count: 0
      });
    });
  }

  /**
   * Get last 30 days work session statistics
   */
  static async getLast30DaysStats(): Promise<WorkSessionStats> {
    const endDate = new Date();
    const endDateStr = endDate.toISOString().split('T')[0];

    const cacheKey = `last-30-days-stats-${endDateStr}`;
    
    return this.getCachedResult(cacheKey, async () => {
      // For 30 days, we might have duplicate problems across days,
      // so we need to get the actual unique problems count using the specialized endpoint
      const summary = await invoke<{
        total_duration_seconds: number;
        unique_problems_count: number;
        total_sessions_count: number;
      }>('get_last_n_days_summary', { days: 30 });

      return {
        total_duration_seconds: summary.total_duration_seconds,
        unique_problems_count: summary.unique_problems_count,
        total_sessions_count: summary.total_sessions_count
      };
    });
  }

  /**
   * Get work session statistics for today
   */
  static async getTodayStats(): Promise<WorkSessionStats> {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `today-stats-${today}`;
    
    return this.getCachedResult(cacheKey, async () => {
      const sessions = await invoke<Array<any>>('get_work_sessions_today');
      
      // Aggregate today's sessions
      const uniqueProblems = new Set<string>();
      let totalDuration = 0;
      
      sessions.forEach(session => {
        uniqueProblems.add(session.problem_id);
        totalDuration += session.duration_seconds || 0;
      });
      
      return {
        total_duration_seconds: totalDuration,
        unique_problems_count: uniqueProblems.size,
        total_sessions_count: sessions.length
      };
    }, 30000); // Shorter cache for today (30 seconds)
  }

  /**
   * Clear all cached data (useful for testing or when data is known to be stale)
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear cache for a specific key pattern
   */
  static clearCacheForPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}