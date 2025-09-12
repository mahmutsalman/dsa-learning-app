import { ReactNode, MouseEventHandler } from 'react';

export interface AnalyticsCardProps {
  title: string;
  primaryValue: string | number;
  secondaryValue?: string | number;
  secondaryLabel?: string;
  icon: ReactNode;
  iconColor?: string;
  loading?: boolean;
  error?: string | null;
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
}

/**
 * Reusable analytics card component for displaying statistics
 * Similar to Dashboard cards but optimized for analytics data
 */
export default function AnalyticsCard({
  title,
  primaryValue,
  secondaryValue,
  secondaryLabel,
  icon,
  iconColor = 'text-primary-500',
  loading = false,
  error = null,
  onClick,
  className = ''
}: AnalyticsCardProps) {
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
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`h-8 w-8 ${iconColor} flex-shrink-0`}>
            {icon}
          </div>
          <div className="ml-4 flex-1">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-2"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-1"></div>
                {secondaryValue !== undefined && (
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-20"></div>
                )}
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
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {primaryValue}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {title}
                </p>
                {secondaryValue !== undefined && (
                  <div className="mt-1 flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {secondaryValue}
                    </span>
                    {secondaryLabel && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {secondaryLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {isClickable && !loading && !error && (
          <div className="ml-2 text-primary-500 dark:text-primary-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Simplified analytics card for basic metrics
 */
export function SimpleAnalyticsCard({ 
  title, 
  primaryValue, 
  icon, 
  iconColor = 'text-primary-500',
  loading = false,
  error = null,
  onClick,
  className = '' 
}: {
  title: string;
  primaryValue: string | number;
  icon: ReactNode;
  iconColor?: string;
  loading?: boolean;
  error?: string | null;
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
}) {
  return (
    <AnalyticsCard
      title={title}
      primaryValue={primaryValue}
      icon={icon}
      iconColor={iconColor}
      loading={loading}
      error={error}
      onClick={onClick}
      className={className}
    />
  );
}