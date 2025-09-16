import { formatDuration, formatDurationCompact } from '../../utils/timeUtils';
import { ProblemTotalWork } from '../../services/WorkSessionService';

interface ProblemTotalsListProps {
  items: ProblemTotalWork[];
  title: string;
  emptyText?: string;
}

export default function ProblemTotalsList({ items, title, emptyText = 'No work recorded in this period.' }: ProblemTotalsListProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">{emptyText}</div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {items.map((it) => (
            <li key={it.problem_id} className="px-4 py-3 flex items-center justify-between">
              <div className="min-w-0 pr-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{it.problem_title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{it.session_count} session{it.session_count !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                {formatDurationCompact(it.total_duration_seconds)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          Total across {items.length} problem{items.length !== 1 ? 's' : ''}: {formatDuration(items.reduce((s, i) => s + i.total_duration_seconds, 0))}
        </div>
      )}
    </div>
  );
}

