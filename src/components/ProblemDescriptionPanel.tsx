import { 
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

export interface ProblemDescriptionPanelProps {
  isCollapsed: boolean;
  onToggle: () => void;
  problem: {
    title: string;
    description: string;
    leetcode_url?: string;
  } | null;
  useWorkspace?: boolean; // Flag to enable workspace integration
}

export default function ProblemDescriptionPanel({ 
  isCollapsed, 
  onToggle, 
  problem,
  useWorkspace = false
}: ProblemDescriptionPanelProps) {
  // Generate width classes based on workspace usage
  const getWidthClasses = () => {
    if (useWorkspace) {
      // In workspace mode, let the workspace container control width
      return 'w-full';
    } else {
      // In standalone mode, use fixed widths
      return isCollapsed ? 'w-12' : 'w-80';
    }
  };

  // Generate padding classes based on workspace usage and collapse state
  const getPaddingClasses = () => {
    if (isCollapsed) {
      return 'justify-center px-2';
    } else {
      // In workspace mode with very narrow widths, use smaller padding
      if (useWorkspace) {
        return 'justify-between px-3';
      } else {
        return 'justify-between px-6';
      }
    }
  };
  if (!problem) {
    return (
      <div className={`${
        getWidthClasses()
      } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out group relative`}>
        <div className={`flex items-center ${
          getPaddingClasses()
        } py-4 border-b border-gray-200 dark:border-gray-700 min-h-[73px]`}>
          {!isCollapsed && (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-opacity duration-300">
              Problem Description
            </h2>
          )}
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isCollapsed ? 'Expand problem panel' : 'Collapse problem panel'}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {isCollapsed ? '' : 'No problem selected'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${
      getWidthClasses()
    } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out group relative`}>
      {/* Header */}
      <div className={`flex items-center ${
        getPaddingClasses()
      } py-4 border-b border-gray-200 dark:border-gray-700 min-h-[73px]`}>
        {!isCollapsed && (
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-opacity duration-300">
            Problem Description
          </h2>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={isCollapsed ? 'Expand problem panel' : 'Collapse problem panel'}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className={`flex-1 ${isCollapsed ? 'hidden' : 'block'} overflow-auto`}>
        <div className={`${useWorkspace ? 'p-3' : 'p-6'} min-w-0`}>
          {/* Problem Title */}
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 problem-title-responsive">
              {problem.title}
            </h3>
          </div>

          {/* Problem Description */}
          <div className="prose dark:prose-invert max-w-none mb-6 min-w-0">
            <div className="text-gray-700 dark:text-gray-300 whitespace-normal leading-relaxed text-sm problem-description-content">
              {problem.description}
            </div>
          </div>
          
          {/* LeetCode Link */}
          {problem.leetcode_url && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <a
                href={problem.leetcode_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2" />
                View on LeetCode
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Collapsed State Tooltip Content */}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-3 py-2 bg-gray-800 dark:bg-gray-700 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 top-4 shadow-lg">
          <div className="font-medium">{problem.title}</div>
          <div className="text-xs text-gray-300 mt-1">Click to expand</div>
        </div>
      )}
    </div>
  );
}