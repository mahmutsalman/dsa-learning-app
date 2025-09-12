import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import AnalyticsCard from './AnalyticsCard';
import { formatDurationHHMMSS } from '../../utils/timeUtils';
import { WorkSessionStats } from '../../services/WorkSessionService';

interface Last30DaysCardProps {
  stats: WorkSessionStats | null;
  loading?: boolean;
  error?: string | null;
  onClick?: () => void;
  className?: string;
}

/**
 * Card component showing last 30 days work statistics
 */
export default function Last30DaysCard({ 
  stats, 
  loading = false, 
  error = null, 
  onClick, 
  className 
}: Last30DaysCardProps) {
  const primaryValue = stats ? formatDurationHHMMSS(stats.total_duration_seconds) : '00:00:00';
  const secondaryValue = stats?.unique_problems_count ?? 0;
  const secondaryLabel = secondaryValue === 1 ? 'problem' : 'problems';

  return (
    <AnalyticsCard
      title="Last 30 Days"
      primaryValue={primaryValue}
      secondaryValue={secondaryValue}
      secondaryLabel={secondaryLabel}
      icon={<ArrowTrendingUpIcon className="h-8 w-8" />}
      iconColor="text-green-500"
      loading={loading}
      error={error}
      onClick={onClick}
      className={className}
    />
  );
}