import { formatDuration, formatDurationCompact } from '../../utils/timeUtils';
import { format } from 'date-fns';
import { ProblemTotalWork } from '../../services/WorkSessionService';

interface ProblemTotalsListProps {
  items: ProblemTotalWork[];
  title: string;
  emptyText?: string;
  onItemClick?: (problemId: string) => void;
  sortBy?: 'duration' | 'recent';
}

export default function ProblemTotalsList({ items, title, emptyText = 'No work recorded in this period.', onItemClick, sortBy = 'duration' }: ProblemTotalsListProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col max-h-[60vh] min-h-0">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">{emptyText}</div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto flex-1 min-h-0 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
          {items.map((it) => (
            <li
              key={it.problem_id}
              className={`px-4 py-3 flex items-center justify-between gap-4 ${onItemClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''}`}
              onClick={() => onItemClick?.(it.problem_id)}
            >
              <div className="min-w-0 pr-3 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{it.problem_title}</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {it.session_count} session{it.session_count !== 1 ? 's' : ''}
                  </p>
                  {sortBy === 'recent' && it.last_activity_ts && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      Last studied: {format(new Date(it.last_activity_ts), 'EEEE p')}
                    </p>
                  )}
                  {it.tags && it.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 overflow-hidden">
                      {it.tags.slice(0, 6).map(tag => (
                        <span
                          key={tag.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600"
                          title={tag.name}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {it.tags.length > 6 && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">+{it.tags.length - 6}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
                {formatDurationCompact(it.total_duration_seconds)}
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          Total across {items.length} problem{items.length !== 1 ? 's' : ''}: {formatDuration(items.reduce((s, i) => s + i.total_duration_seconds, 0))}
        </div>
      )}
    </div>
  );
}
