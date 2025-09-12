import { useEffect } from 'react';
import { useWorkSessionStats } from '../hooks/useWorkSessionStats';
import YesterdayCard from '../components/Analytics/YesterdayCard';
import Last7DaysCard from '../components/Analytics/Last7DaysCard';
import Last30DaysCard from '../components/Analytics/Last30DaysCard';

export default function Analytics() {
  const {
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
      yesterdayStats,
      last7DaysStats,
      last30DaysStats,
      loading,
      errors,
    });
  }, [yesterdayStats, last7DaysStats, last30DaysStats, loading, errors]);

  // Handle card click actions (for future drill-down functionality)
  const handleYesterdayClick = () => {
    console.log('Yesterday card clicked');
    // Future: Navigate to detailed yesterday view
  };

  const handleLast7DaysClick = () => {
    console.log('Last 7 days card clicked');
    // Future: Navigate to detailed 7-day view
  };

  const handleLast30DaysClick = () => {
    console.log('Last 30 days card clicked');
    // Future: Navigate to detailed 30-day view
  };

  // Handle refresh actions
  const handleRefreshAll = () => {
    console.log('Refreshing all analytics data...');
    refresh();
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
          disabled={loading.yesterday || loading.last7Days || loading.last30Days}
          className="
            inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md
            text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 
            focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
          "
        >
          <svg 
            className={`-ml-1 mr-2 h-4 w-4 ${
              (loading.yesterday || loading.last7Days || loading.last30Days) ? 'animate-spin' : ''
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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