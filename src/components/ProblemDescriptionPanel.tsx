import { useState } from 'react';
import { 
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Problem } from '../types';
import RelatedProblemsSection from './RelatedProblemsSection';

export interface ProblemDescriptionPanelProps {
  isCollapsed: boolean;
  onToggle: () => void;
  problem: Problem | null;
  useWorkspace?: boolean; // Flag to enable workspace integration
  onDescriptionUpdate?: (problemId: string, newDescription: string) => Promise<boolean>;
}

export default function ProblemDescriptionPanel({ 
  isCollapsed, 
  onToggle, 
  problem,
  useWorkspace = false,
  onDescriptionUpdate
}: ProblemDescriptionPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startEditing = () => {
    if (problem) {
      setEditedDescription(problem.description);
      setIsEditing(true);
      setSaveError(null);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedDescription('');
    setSaveError(null);
  };

  const saveDescription = async () => {
    if (!problem || !onDescriptionUpdate || editedDescription.trim() === '') {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      
      const success = await onDescriptionUpdate(problem.id, editedDescription.trim());
      
      if (success) {
        setIsEditing(false);
        setEditedDescription('');
      } else {
        setSaveError('Failed to update description');
      }
    } catch (error) {
      console.error('Error saving description:', error);
      setSaveError('Failed to update description');
    } finally {
      setIsSaving(false);
    }
  };
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
          <div className="flex items-center flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-opacity duration-300">
              Problem Description
            </h2>
            {/* Edit Button - Only show if onDescriptionUpdate is provided and not editing */}
            {onDescriptionUpdate && !isEditing && (
              <button
                onClick={startEditing}
                className="ml-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                title="Edit description"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
            )}
            {/* Edit Mode Controls */}
            {isEditing && (
              <div className="ml-2 flex items-center space-x-1">
                <button
                  onClick={saveDescription}
                  disabled={isSaving || editedDescription.trim() === ''}
                  className="p-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors text-green-600 dark:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save changes"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Cancel editing"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}
            {/* Save status indicator */}
            {isSaving && (
              <div className="ml-2 flex items-center text-blue-600 dark:text-blue-400">
                <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
                <span className="ml-1 text-xs">Saving...</span>
              </div>
            )}
          </div>
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

          {/* Problem Description - View Mode */}
          {!isEditing && (
            <div className="prose dark:prose-invert max-w-none mb-6 min-w-0">
              <div className="text-gray-700 dark:text-gray-300 whitespace-normal leading-relaxed text-sm problem-description-content">
                {problem.description}
              </div>
            </div>
          )}

          {/* Problem Description - Edit Mode */}
          {isEditing && (
            <div className="mb-6 min-w-0">
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-gray-300 text-sm resize-none"
                placeholder="Enter problem description..."
              />
              {/* Error message */}
              {saveError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {saveError}
                </p>
              )}
              {/* Character count helper */}
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {editedDescription.length} characters
              </div>
            </div>
          )}

          {/* Constraints - Only show when not editing and constraints exist */}
          {!isEditing && Array.isArray(problem.constraints) && problem.constraints.length > 0 && problem.constraints.some(c => c && c.trim()) && (
            <div className="mb-6">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Constraints</h4>
              <div className="space-y-2">
                {problem.constraints.filter(c => c && c.trim()).map((constraint, index) => (
                  <div key={index} className="flex items-start">
                    <span className="text-primary-600 dark:text-primary-400 mr-2 mt-1 text-xs">•</span>
                    <span className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{constraint}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hints - Only show when not editing and hints exist */}
          {!isEditing && Array.isArray(problem.hints) && problem.hints.length > 0 && problem.hints.some(h => h && h.trim()) && (
            <div className="mb-6">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Hints</h4>
              <div className="space-y-3">
                {problem.hints.filter(h => h && h.trim()).map((hint, index) => (
                  <div key={index} className="flex items-start">
                    <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs font-medium px-2 py-1 rounded-md mr-3 mt-0.5 flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{hint}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Problems - Only show when not editing */}
          {!isEditing && (
            <div className="mb-6">
              <RelatedProblemsSection
                problemId={problem.id}
                onUpdate={() => {
                  // Optionally reload problem data or notify parent
                }}
              />
            </div>
          )}
          
          {/* LeetCode Link - Only show when not editing */}
          {!isEditing && problem.leetcode_url && (
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