import { invoke } from '@tauri-apps/api/core';
import type { Tag } from '../types';

export interface WorkSessionStats {
  total_duration_seconds: number;
  unique_problems_count: number;
  total_sessions_count: number;
}

export interface ProblemTotalWork {
  problem_id: string;
  problem_title: string;
  total_duration_seconds: number;
  session_count: number;
  tags?: Tag[];
  // Unix ms timestamp of the most recent session in the range
  last_activity_ts?: number;
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
   * Get aggregated totals by problem within a date range
   */
  static async getProblemTotalsForRange(startDateStr: string, endDateStr: string): Promise<ProblemTotalWork[]> {
    const cacheKey = `problem-totals-${startDateStr}-${endDateStr}`;

    return this.getCachedResult(cacheKey, async () => {
      const sessions = await invoke<Array<{
        problem_id: string;
        problem_title: string;
        duration_seconds: number;
        session_date: string;
        start_timestamp?: string;
        end_timestamp?: string | null;
      }>>('get_work_sessions_date_range', {
        request: { start_date: startDateStr, end_date: endDateStr }
      });

      const map = new Map<string, ProblemTotalWork>();
      for (const s of sessions) {
        const key = s.problem_id;
        // derive a last-activity timestamp from start/end
        const startMs = s.start_timestamp ? Date.parse(s.start_timestamp) : 0;
        const endMs = s.end_timestamp ? Date.parse(s.end_timestamp) : 0;
        const sessionTs = Math.max(startMs, endMs);
        const prev = map.get(key);
        if (prev) {
          prev.total_duration_seconds += s.duration_seconds || 0;
          prev.session_count += 1;
          if (sessionTs && (!prev.last_activity_ts || sessionTs > prev.last_activity_ts)) {
            prev.last_activity_ts = sessionTs;
          }
        } else {
          map.set(key, {
            problem_id: s.problem_id,
            problem_title: s.problem_title,
            total_duration_seconds: s.duration_seconds || 0,
            session_count: 1,
            last_activity_ts: sessionTs || undefined,
          });
        }
      }
      const items = Array.from(map.values());

      // Enrich with tags in parallel (best-effort)
      const tagPromises = items.map(async (it) => {
        try {
          const tags = await invoke<Tag[]>('get_problem_tags', { problemId: it.problem_id });
          it.tags = tags || [];
        } catch (e) {
          // ignore tag load errors; keep list usable
          it.tags = [];
        }
      });
      await Promise.allSettled(tagPromises);

      // Default order by total duration desc; caller may re-sort for recency
      return items.sort((a, b) => b.total_duration_seconds - a.total_duration_seconds);
    });
  }

  static async getProblemTotalsForLast7Days(): Promise<ProblemTotalWork[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 6);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    return this.getProblemTotalsForRange(startDateStr, endDateStr);
  }

  static async getProblemTotalsForLast30Days(): Promise<ProblemTotalWork[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 29);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    return this.getProblemTotalsForRange(startDateStr, endDateStr);
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
