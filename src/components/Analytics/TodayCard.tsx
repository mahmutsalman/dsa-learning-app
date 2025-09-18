import { SunIcon } from '@heroicons/react/24/outline';
import AnalyticsCard from './AnalyticsCard';
import { formatDurationHHMMSS } from '../../utils/timeUtils';
import { WorkSessionStats } from '../../services/WorkSessionService';

interface TodayCardProps {
  stats: WorkSessionStats | null;
  loading?: boolean;
  error?: string | null;
  onClick?: () => void;
  className?: string;
}

/**
 * Card component showing today's work statistics
 */
export default function TodayCard({
  stats,
  loading = false,
  error = null,
  onClick,
  className,
}: TodayCardProps) {
  const primaryValue = stats ? formatDurationHHMMSS(stats.total_duration_seconds) : '00:00:00';
  const secondaryValue = stats?.unique_problems_count ?? 0;
  const secondaryLabel = secondaryValue === 1 ? 'problem' : 'problems';

  return (
    <AnalyticsCard
      title="Today's Work"
      primaryValue={primaryValue}
      secondaryValue={secondaryValue}
      secondaryLabel={secondaryLabel}
      icon={<SunIcon className="h-8 w-8" />}
      iconColor="text-amber-500"
      loading={loading}
      error={error}
      onClick={onClick}
      className={className}
    />
  );
}
