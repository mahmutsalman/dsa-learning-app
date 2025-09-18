import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkSessionStats } from '../hooks/useWorkSessionStats';
import TodayCard from '../components/Analytics/TodayCard';
import YesterdayCard from '../components/Analytics/YesterdayCard';
import Last7DaysCard from '../components/Analytics/Last7DaysCard';
import Last30DaysCard from '../components/Analytics/Last30DaysCard';
import ProblemTotalsList from '../components/Analytics/ProblemTotalsList';
import { WorkSessionService, ProblemTotalWork } from '../services/WorkSessionService';

export default function Analytics() {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<'7' | '30' | null>(null);
  const [sortBy, setSortBy] = useState<'duration' | 'recent'>('duration');
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [sevenDayItems, setSevenDayItems] = useState<ProblemTotalWork[] | null>(null);
  const [thirtyDayItems, setThirtyDayItems] = useState<ProblemTotalWork[] | null>(null);
  const {
    todayStats,
    yesterdayStats,
    last7DaysStats,
    last30DaysStats,
    loading,
    errors,
    refresh,
  } = useWorkSessionStats();

  // Log analytics data for debugging
  useEffect(() => {
    console.log('Analytics data:', {
      todayStats,
      yesterdayStats,
      last7DaysStats,
      last30DaysStats,
      loading,
      errors,
    });
  }, [todayStats, yesterdayStats, last7DaysStats, last30DaysStats, loading, errors]);

  // Handle card click actions (for future drill-down functionality)
  const handleYesterdayClick = () => {
    console.log('Yesterday card clicked');
    // Future: Navigate to detailed yesterday view
  };

  const handleLast7DaysClick = async () => {
    // Toggle expansion
    const next = expanded === '7' ? null : '7';
    setExpanded(next);
    saveAnalyticsState(next);
    if (next === '7' && !sevenDayItems) {
      try {
        setListLoading(true);
        setListError(null);
        const items = await WorkSessionService.getProblemTotalsForLast7Days();
        setSevenDayItems(items);
      } catch (e) {
        setListError(e instanceof Error ? e.message : 'Failed to load 7-day breakdown');
      } finally {
        setListLoading(false);
      }
    }
  };

  const handleLast30DaysClick = async () => {
    const next = expanded === '30' ? null : '30';
    setExpanded(next);
    saveAnalyticsState(next);
    if (next === '30' && !thirtyDayItems) {
      try {
        setListLoading(true);
        setListError(null);
        const items = await WorkSessionService.getProblemTotalsForLast30Days();
        setThirtyDayItems(items);
      } catch (e) {
        setListError(e instanceof Error ? e.message : 'Failed to load 30-day breakdown');
      } finally {
        setListLoading(false);
      }
    }
  };

  // If restored state sets expanded, auto-load the corresponding list
  useEffect(() => {
    const loadForExpanded = async () => {
      if (expanded === '7' && !sevenDayItems && !listLoading) {
        try {
          setListLoading(true);
          const items = await WorkSessionService.getProblemTotalsForLast7Days();
          setSevenDayItems(items);
        } catch (e) {
          setListError(e instanceof Error ? e.message : 'Failed to load 7-day breakdown');
        } finally {
          setListLoading(false);
        }
      } else if (expanded === '30' && !thirtyDayItems && !listLoading) {
        try {
          setListLoading(true);
          const items = await WorkSessionService.getProblemTotalsForLast30Days();
          setThirtyDayItems(items);
        } catch (e) {
          setListError(e instanceof Error ? e.message : 'Failed to load 30-day breakdown');
        } finally {
          setListLoading(false);
        }
      }
    };
    loadForExpanded();
  }, [expanded]);

  // Handle refresh actions
  const handleRefreshAll = () => {
    console.log('Refreshing all analytics data...');
    refresh();
  };

  // Persist/restore simple UI state for Analytics (expanded section + scroll)
  const saveAnalyticsState = (nextExpanded: '7' | '30' | null = expanded) => {
    try {
      const state = {
        expanded: nextExpanded,
        scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
        sortBy,
        ts: Date.now(),
      };
      sessionStorage.setItem('analyticsState', JSON.stringify(state));
    } catch {}
  };

  useEffect(() => {
    // On mount, restore saved state
    try {
      const raw = sessionStorage.getItem('analyticsState');
      if (raw) {
        const st = JSON.parse(raw) as { expanded?: '7' | '30' | null; scrollY?: number; sortBy?: 'duration' | 'recent' };
        if (st.expanded === '7' || st.expanded === '30' || st.expanded === null) {
          setExpanded(st.expanded ?? null);
        }
        if (st.sortBy === 'duration' || st.sortBy === 'recent') {
          setSortBy(st.sortBy);
        }
        const y = typeof st.scrollY === 'number' ? st.scrollY : 0;
        setTimeout(() => { try { window.scrollTo(0, y); } catch {} }, 50);
      }
    } catch {}
  }, []);

  // Navigate to a problem's most recent card and remember we came from analytics
  const openProblemFromAnalytics = async (problemId: string) => {
    try {
      // Persist UI state + origin flag before navigating
      saveAnalyticsState(expanded);
      sessionStorage.setItem('fromAnalytics', 'true');
      const cards = await (window as any).__TAURI_INVOKE__
        ? await (await import('@tauri-apps/api/core')).invoke<any[]>('get_cards_for_problem', { problemId })
        : await (await import('@tauri-apps/api/core')).invoke<any[]>('get_cards_for_problem', { problemId });

      if (Array.isArray(cards) && cards.length > 0) {
        // Pick most recently modified card
        const sorted = [...cards].sort((a, b) => {
          const at = new Date(a.last_modified || a.created_at || 0).getTime();
          const bt = new Date(b.last_modified || b.created_at || 0).getTime();
          return bt - at;
        });
        const target = sorted[0];
        navigate(`/problem/${problemId}/card/${target.id}`);
      } else {
        // No cards - just navigate to the problem (Problem view may create first card)
        navigate(`/problem/${problemId}`);
      }
    } catch (e) {
      console.error('Failed to open problem from analytics:', e);
    }
  };

  // Sorting helpers for lists
  const sortItems = (items: ProblemTotalWork[] | null): ProblemTotalWork[] => {
    if (!items) return [];
    if (sortBy === 'recent') {
      return [...items].sort((a, b) => (b.last_activity_ts || 0) - (a.last_activity_ts || 0));
    }
    // duration
    return [...items].sort((a, b) => (b.total_duration_seconds) - (a.total_duration_seconds));
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Track your learning progress and work patterns
          </p>
        </div>
        
        {/* Refresh Button */}
        <button
          onClick={handleRefreshAll}
          disabled={loading.today || loading.yesterday || loading.last7Days || loading.last30Days}
          className="
            inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
            text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 
            focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
          "
        >
          <svg 
            className={`-ml-1 mr-2 h-4 w-4 ${
              (loading.today || loading.yesterday || loading.last7Days || loading.last30Days) ? 'animate-spin' : ''
            }`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Today Card */}
        <TodayCard
          stats={todayStats}
          loading={loading.today}
          error={errors.today}
        />

        {/* Yesterday Card */}
        <YesterdayCard
          stats={yesterdayStats}
          loading={loading.yesterday}
          error={errors.yesterday}
          onClick={handleYesterdayClick}
        />
        
        {/* Last 7 Days Card */}
        <Last7DaysCard
          stats={last7DaysStats}
          loading={loading.last7Days}
          error={errors.last7Days}
          onClick={handleLast7DaysClick}
        />
        
        {/* Last 30 Days Card */}
        <Last30DaysCard
          stats={last30DaysStats}
          loading={loading.last30Days}
          error={errors.last30Days}
          onClick={handleLast30DaysClick}
        />
      </div>

      {/* Expandable Lists Section */}
      {(expanded === '7' || expanded === '30') && (
        <div className="space-y-4">
          {/* List controls */}
          <div className="flex items-center justify-end gap-3">
            <label className="text-xs text-gray-500 dark:text-gray-400">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => { const val = e.target.value as 'duration' | 'recent'; setSortBy(val); saveAnalyticsState(expanded); }}
              className="text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-2 py-1"
            >
              <option value="duration">Duration</option>
              <option value="recent">Recent</option>
            </select>
          </div>
          {listLoading && (
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading breakdown…</div>
          )}
          {listError && (
            <div className="text-sm text-red-600">{listError}</div>
          )}
          {!listLoading && !listError && expanded === '7' && (
            <ProblemTotalsList
              title="Problems worked in the last 7 days"
              items={sortItems(sevenDayItems)}
              onItemClick={openProblemFromAnalytics}
              sortBy={sortBy}
            />
          )}
          {!listLoading && !listError && expanded === '30' && (
            <ProblemTotalsList
              title="Problems worked in the last 30 days"
              items={sortItems(thirtyDayItems)}
              onItemClick={openProblemFromAnalytics}
              sortBy={sortBy}
            />
          )}
        </div>
      )}

      {/* Additional Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          About Analytics
        </h2>
        <div className="text-gray-600 dark:text-gray-400 space-y-2">
          <p>
            This analytics dashboard tracks your learning sessions and provides insights into your study patterns.
          </p>
          <ul className="list-disc list-inside space-y-1 mt-3">
            <li>
              <strong>Duration</strong>: Total time spent working on problems
            </li>
            <li>
              <strong>Problems</strong>: Number of unique problems you worked on
            </li>
            <li>
              <strong>Sessions</strong>: Individual study sessions recorded
            </li>
          </ul>
          <p className="mt-3 text-sm">
            Data is automatically refreshed at midnight and cached for better performance.
            Click the refresh button to update data manually.
          </p>
        </div>
      </div>

      {/* Debug Information (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-xs">
          <details>
            <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300">
              Debug Information
            </summary>
            <pre className="mt-2 text-gray-600 dark:text-gray-400 overflow-x-auto">
              {JSON.stringify({
                yesterdayStats,
                last7DaysStats,
                last30DaysStats,
                loading,
                errors,
              }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
