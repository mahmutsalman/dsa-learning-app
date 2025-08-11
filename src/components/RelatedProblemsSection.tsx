import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PlusIcon, XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import { Problem } from '../types';
import ProblemAutocomplete from './ProblemAutocomplete';

interface RelatedProblemsSectionProps {
  problemId: string;
  onUpdate?: () => void;
  className?: string;
}

export default function RelatedProblemsSection({
  problemId,
  onUpdate,
  className = ""
}: RelatedProblemsSectionProps) {
  const navigate = useNavigate();
  const [relatedProblems, setRelatedProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAddingRelation, setIsAddingRelation] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Load related problems
  const loadRelatedProblems = async () => {
    setIsLoading(true);
    try {
      const related = await invoke<Problem[]>('get_related_problems', {
        problemId
      });
      setRelatedProblems(related);
    } catch (error) {
      console.error('Failed to load related problems:', error);
      setRelatedProblems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRelatedProblems();
  }, [problemId]);

  const handleAddRelation = async (selectedProblem: Problem) => {
    setIsAddingRelation(true);
    try {
      await invoke('add_problem_relation', {
        problemId,
        relatedProblemId: selectedProblem.id
      });

      // Reload related problems
      await loadRelatedProblems();
      setShowAddForm(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to add problem relation:', error);
      // TODO: Show toast notification
    } finally {
      setIsAddingRelation(false);
    }
  };

  const handleRemoveRelation = async (relatedProblemId: string) => {
    setRemovingId(relatedProblemId);
    try {
      await invoke('remove_problem_relation', {
        problemId,
        relatedProblemId
      });

      // Reload related problems
      await loadRelatedProblems();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to remove problem relation:', error);
      // TODO: Show toast notification
    } finally {
      setRemovingId(null);
    }
  };

  const handleNavigateToProblem = (relatedProblemId: string) => {
    // Store current problem in navigation history for back button
    sessionStorage.setItem('previousProblem', problemId);
    navigate(`/problem/${relatedProblemId}`);
  };

  const difficultyColors = {
    'Easy': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    'Medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Hard': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white">
          Related Problems
        </h4>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={isAddingRelation}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon className="h-3 w-3" />
          Add Related
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Connect to Problem
            </span>
            <button
              onClick={() => setShowAddForm(false)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <XMarkIcon className="h-4 w-4 text-gray-500" />
            </button>
          </div>
          <ProblemAutocomplete
            onSelect={handleAddRelation}
            excludeId={problemId}
            placeholder="Search for problems to connect..."
            className="w-full"
          />
          {isAddingRelation && (
            <div className="mt-2 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
              <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
              Adding connection...
            </div>
          )}
        </div>
      )}

      {/* Related problems list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border border-gray-300 border-t-transparent"></div>
          Loading related problems...
        </div>
      ) : relatedProblems.length > 0 ? (
        <div className="space-y-2">
          {relatedProblems.map((problem) => (
            <div
              key={problem.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 transition-colors group"
            >
              <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">
                    {problem.title}
                  </h5>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                    difficultyColors[problem.difficulty as keyof typeof difficultyColors] || 'bg-gray-100 text-gray-800'
                  }`}>
                    {problem.difficulty}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                  {problem.description}
                </p>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleNavigateToProblem(problem.id)}
                  className="p-1.5 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
                  title="Navigate to problem"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleRemoveRelation(problem.id)}
                  disabled={removingId === problem.id}
                  className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove connection"
                >
                  {removingId === problem.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border border-current border-t-transparent"></div>
                  ) : (
                    <XMarkIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No related problems yet. Click "Add Related" to connect problems.
        </div>
      )}
    </div>
  );
}