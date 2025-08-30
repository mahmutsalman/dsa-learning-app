import { useState } from 'react';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ProblemPreviewProps } from './types';

export function ProblemPreview({ 
  problems, 
  errors, 
  onImport, 
  onCancel, 
  isLoading = false 
}: ProblemPreviewProps) {
  const [selectedProblems, setSelectedProblems] = useState<Set<string>>(
    new Set(problems.map(p => p.title))
  );
  const [expandedProblem, setExpandedProblem] = useState<string | null>(null);


  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;

  const handleToggleAll = () => {
    if (selectedProblems.size === problems.length) {
      setSelectedProblems(new Set());
    } else {
      setSelectedProblems(new Set(problems.map(p => p.title)));
    }
  };

  const handleToggleProblem = (title: string) => {
    const newSelected = new Set(selectedProblems);
    if (newSelected.has(title)) {
      newSelected.delete(title);
    } else {
      newSelected.add(title);
    }
    setSelectedProblems(newSelected);
  };

  const handleImport = () => {
    const selectedProblemObjects = problems.filter(p => selectedProblems.has(p.title));
    onImport(selectedProblemObjects);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      case 'Medium': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'Hard': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Import Preview
          </h3>
          <div className="flex items-center space-x-4 text-sm">
            <span className="text-green-600 dark:text-green-400">
              {problems.length} valid problems
            </span>
            {errorCount > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {errorCount} errors
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                {warningCount} warnings
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={selectedProblems.size === problems.length}
              onChange={handleToggleAll}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Select all problems ({selectedProblems.size} of {problems.length} selected)
            </span>
          </label>
        </div>
      </div>

      {/* Errors and Warnings */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg border ${
                error.severity === 'error'
                  ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                  : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
              }`}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {error.severity === 'error' ? (
                    <XMarkIcon className="h-5 w-5 text-red-400" />
                  ) : (
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                  )}
                </div>
                <div className="ml-3">
                  <p className={`text-sm font-medium ${
                    error.severity === 'error'
                      ? 'text-red-800 dark:text-red-200'
                      : 'text-yellow-800 dark:text-yellow-200'
                  }`}>
                    Line {error.line}: {error.message}
                    {error.field && (
                      <span className="ml-2 text-xs opacity-75">({error.field})</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Problem List */}
      <div className="space-y-3">
        <h4 className="text-md font-medium text-gray-900 dark:text-white">
          Problems to Import
        </h4>
        
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {problems.map((problem, index) => (
            <div
              key={`${problem.title}-${index}`}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={selectedProblems.has(problem.title)}
                  onChange={() => handleToggleProblem(problem.title)}
                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-2">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {problem.title}
                    </h5>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(problem.difficulty)}`}>
                      {problem.difficulty}
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                    {problem.description}
                  </p>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    {problem.topics.length > 0 && (
                      <span>Topics: {problem.topics.slice(0, 3).join(', ')}{problem.topics.length > 3 ? '...' : ''}</span>
                    )}
                    {problem.tags.length > 0 && (
                      <span>Tags: {problem.tags.length}</span>
                    )}
                    {problem.leetcodeUrl && (
                      <span className="text-blue-500">LeetCode URL</span>
                    )}
                  </div>
                  
                  {(expandedProblem === problem.title) && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2 text-xs">
                      {problem.topics.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Topics:</span>
                          <span className="ml-2 text-gray-600 dark:text-gray-400">{problem.topics.join(', ')}</span>
                        </div>
                      )}
                      {problem.tags.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Tags:</span>
                          <span className="ml-2 text-gray-600 dark:text-gray-400">{problem.tags.join(', ')}</span>
                        </div>
                      )}
                      {problem.constraints.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Constraints:</span>
                          <ul className="ml-4 mt-1 list-disc list-inside text-gray-600 dark:text-gray-400">
                            {problem.constraints.map((constraint, idx) => (
                              <li key={idx}>{constraint}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {problem.hints.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">Hints:</span>
                          <ul className="ml-4 mt-1 list-disc list-inside text-gray-600 dark:text-gray-400">
                            {problem.hints.map((hint, idx) => (
                              <li key={idx}>{hint}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => setExpandedProblem(
                    expandedProblem === problem.title ? null : problem.title
                  )}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                >
                  <svg className={`h-4 w-4 transition-transform ${
                    expandedProblem === problem.title ? 'rotate-180' : ''
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {selectedProblems.size} problems selected for import
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          
          <button
            onClick={handleImport}
            disabled={selectedProblems.size === 0 || isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Importing...
              </div>
            ) : (
              `Import ${selectedProblems.size} Problems`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}