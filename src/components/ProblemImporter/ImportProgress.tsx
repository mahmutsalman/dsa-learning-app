import { ImportProgressProps } from './types';

export function ImportProgress({ progress, onCancel }: ImportProgressProps) {
  const percentage = progress.totalProblems > 0 
    ? Math.round((progress.currentProblem / progress.totalProblems) * 100)
    : 0;

  const getStepMessage = () => {
    switch (progress.currentStep) {
      case 'parsing':
        return 'Parsing TXT file...';
      case 'validation':
        return 'Validating problem data...';
      case 'preview':
        return 'Preparing preview...';
      case 'importing':
        return `Importing problem ${progress.currentProblem} of ${progress.totalProblems}...`;
      case 'complete':
        return 'Import completed!';
      default:
        return 'Processing...';
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          {progress.isComplete ? 'Import Complete!' : 'Importing Problems'}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {getStepMessage()}
        </p>
      </div>

      {/* Progress Circle */}
      <div className="flex justify-center">
        <div className="relative">
          <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            {progress.isComplete ? (
              <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
                progress.hasErrors 
                  ? 'bg-yellow-100 dark:bg-yellow-900/20' 
                  : 'bg-green-100 dark:bg-green-900/20'
              }`}>
                {progress.hasErrors ? (
                  <svg className="w-12 h-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                ) : (
                  <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            ) : (
              <>
                {/* Progress ring */}
                <svg className="w-28 h-28 transform -rotate-90 absolute">
                  <circle
                    cx="56"
                    cy="56"
                    r="50"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    className="text-gray-300 dark:text-gray-600"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="50"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - percentage / 100)}`}
                    className="text-blue-500 transition-all duration-300"
                    strokeLinecap="round"
                  />
                </svg>
                
                {/* Percentage text */}
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {percentage}%
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {progress.currentProblem} / {progress.totalProblems}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar (Alternative view) */}
      {progress.currentStep === 'importing' && !progress.isComplete && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Progress</span>
            <span>{progress.currentProblem} / {progress.totalProblems} problems</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Messages */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {progress.isComplete ? (
              progress.hasErrors ? (
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.19-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.236 4.53L7.53 10.22a.75.75 0 00-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
              )
            ) : (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
            )}
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {progress.isComplete 
                ? (progress.hasErrors ? 'Import completed with warnings' : 'Import successful!') 
                : 'Import in progress'}
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              {progress.isComplete 
                ? 'You can view the results on the next screen.' 
                : 'Please wait while we process your problems. This may take a few moments.'}
            </p>
          </div>
        </div>
      </div>

      {/* Cancel button (only show during import) */}
      {!progress.isComplete && onCancel && (
        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel Import
          </button>
        </div>
      )}
    </div>
  );
}