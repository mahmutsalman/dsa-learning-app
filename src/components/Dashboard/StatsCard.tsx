import { ReactNode, MouseEventHandler } from 'react';

export interface StatsCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  loading?: boolean;
  error?: string | null;
  iconColor?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
}

/**
 * Reusable stats card component for displaying dashboard statistics
 */
export default function StatsCard({
  icon,
  value,
  label,
  loading = false,
  error = null,
  iconColor = 'text-primary-500',
  onClick,
  className = ''
}: StatsCardProps) {
  const isClickable = !!onClick;

  return (
    <div 
      className={`
        bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700
        ${isClickable ? 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all duration-200' : ''}
        ${className}
      `}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyPress={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e as any);
        }
      } : undefined}
    >
      <div className="flex items-center">
        <div className={`h-8 w-8 ${iconColor} flex-shrink-0`}>
          {icon}
        </div>
        <div className="ml-4 flex-1">
          {loading ? (
            <div className="animate-pulse">
              <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-2"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
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
                {value}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {label}
              </p>
            </div>
          )}
        </div>
        {isClickable && !loading && !error && (
          <div className="ml-2 text-primary-500 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Stats card variant with custom content area
 */
export function CustomStatsCard({ 
  children, 
  onClick,
  className = '' 
}: { 
  children: ReactNode; 
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
}) {
  const isClickable = !!onClick;

  return (
    <div 
      className={`
        bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700
        ${isClickable ? 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all duration-200 group' : ''}
        ${className}
      `}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyPress={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e as any);
        }
      } : undefined}
    >
      {children}
    </div>
  );
}