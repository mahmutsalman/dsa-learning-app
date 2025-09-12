import { CalendarDaysIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { useWorkedTodayStats } from '../../hooks/useWorkedTodayStats';
import { useWorkedTodayFilterState } from '../../hooks/useWorkedTodayFilter';
import { formatDurationHHMMSS } from '../../utils/timeUtils';
import { CustomStatsCard } from './StatsCard';

interface TodaysWorkCardProps {
  onClick?: () => void;
  className?: string;
  showFilterIndicator?: boolean;
}

/**
 * Specialized component for displaying today's work count and total duration
 * Shows the number of problems that have had study sessions today
 * Includes visual indicator when filter is active
 */
export default function TodaysWorkCard({ 
  onClick, 
  className,
  showFilterIndicator = true 
}: TodaysWorkCardProps) {
  const { stats, loading, error, refresh } = useWorkedTodayStats();
  const { isFiltered } = useWorkedTodayFilterState();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      // Default behavior: refresh the data when clicked
      refresh();
    }
  };

  // Create enhanced className that includes active state styling
  const enhancedClassName = `
    ${className || ''}
    ${isFiltered ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg' : ''}
  `.trim();

  // Determine the icon to show
  const iconElement = showFilterIndicator && isFiltered ? (
    <div className="relative">
      <CalendarDaysIcon className="h-8 w-8" />
      <FunnelIcon className="h-4 w-4 absolute -top-1 -right-1 text-blue-600" />
    </div>
  ) : (
    <CalendarDaysIcon className="h-8 w-8" />
  );

  const iconColor = isFiltered ? "text-blue-600" : "text-blue-500";

  return (
    <CustomStatsCard
      onClick={handleClick}
      className={enhancedClassName}
    >
      <div className="flex items-center">
        <div className={`h-8 w-8 ${iconColor} flex-shrink-0`}>
          {iconElement}
        </div>
        <div className="ml-4 flex-1">
          {loading ? (
            <div className="animate-pulse">
              <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20 mb-1"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
            </div>
          ) : error ? (
            <div>
              <h3 className="text-lg font-semibold text-red-500 dark:text-red-400">
                Error
              </h3>
              <p className="text-sm text-red-400 dark:text-red-500" title={error}>
                Failed to load
              </p>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {stats?.count ?? 0}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {isFiltered ? "Worked Today (Filtered)" : "Worked Today"}
              </p>
              <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mt-1">
                {formatDurationHHMMSS(stats?.totalDuration ?? 0)}
              </p>
            </div>
          )}
        </div>
        {onClick && !loading && !error && (
          <div className="ml-2 text-primary-500 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>
    </CustomStatsCard>
  );
}

/**
 * Alternative version that shows more detailed information
 */
export function DetailedTodaysWorkCard({ onClick, className }: TodaysWorkCardProps) {
  const { stats, loading, error, refresh } = useWorkedTodayStats();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      refresh();
    }
  };

  const count = stats?.count ?? 0;
  const totalDuration = stats?.totalDuration ?? 0;

  const getEncouragementText = (count: number): string => {
    if (count === 0) return "Start your day!";
    if (count === 1) return "Great start!";
    if (count <= 3) return "Keep going!";
    if (count <= 5) return "Excellent work!";
    return "Amazing progress!";
  };

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
        <div className="animate-pulse flex items-center">
          <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="ml-4">
            <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-2"></div>
            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-1"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className={`
          bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700
          ${onClick ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200' : ''}
          ${className}
        `}
        onClick={handleClick}
      >
        <div className="flex items-center">
          <CalendarDaysIcon className="h-8 w-8 text-blue-500 flex-shrink-0" />
          <div className="ml-4">
            <h3 className="text-lg font-semibold text-red-500 dark:text-red-400">Error</h3>
            <p className="text-sm text-red-400 dark:text-red-500">Failed to load</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`
        bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700
        ${onClick ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200 group' : ''}
        ${className}
      `}
      onClick={handleClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <CalendarDaysIcon className="h-8 w-8 text-blue-500 flex-shrink-0" />
          <div className="ml-4">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {count}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Problems Worked Today
            </p>
            <p className="text-sm font-mono text-gray-500 dark:text-gray-400 mt-1">
              {formatDurationHHMMSS(totalDuration)}
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mt-1">
              {getEncouragementText(count)}
            </p>
          </div>
        </div>
        {onClick && (
          <div className="text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Progress indicator */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>Daily Progress</span>
          <span>{count}/∞</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
          <div 
            className="bg-blue-500 h-1 rounded-full transition-all duration-500 ease-out"
            style={{ 
              width: count === 0 ? '0%' : `${Math.min((count / 5) * 100, 100)}%` 
            }}
          />
        </div>
      </div>
    </div>
  );
}