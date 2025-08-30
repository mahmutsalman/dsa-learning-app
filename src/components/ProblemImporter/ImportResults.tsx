import { CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { ImportResultsProps } from './types';

export function ImportResults({ result, onClose, onRetry }: ImportResultsProps) {
  const hasErrors = result.errorCount > 0;
  const hasWarnings = result.errors.some(e => e.severity === 'warning');
  const hasSkipped = result.skippedCount > 0;

  const getStatusIcon = () => {
    if (hasErrors) {
      return <XCircleIcon className="h-12 w-12 text-red-500" />;
    }
    if (hasWarnings || hasSkipped) {
      return <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500" />;
    }
    return <CheckCircleIcon className="h-12 w-12 text-green-500" />;
  };

  const getStatusMessage = () => {
    if (hasErrors) {
      return 'Import completed with errors';
    }
    if (hasWarnings || hasSkipped) {
      return 'Import completed with warnings';
    }
    return 'Import completed successfully';
  };

  const getStatusDescription = () => {
    const parts = [];
    
    if (result.importedCount > 0) {
      parts.push(`${result.importedCount} problem${result.importedCount !== 1 ? 's' : ''} imported`);
    }
    
    if (result.skippedCount > 0) {
      parts.push(`${result.skippedCount} skipped (duplicates)`);
    }
    
    if (result.errorCount > 0) {
      parts.push(`${result.errorCount} failed`);
    }
    
    return parts.join(', ');
  };

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="text-center">
        <div className="flex justify-center mb-4">
          {getStatusIcon()}
        </div>
        
        <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
          {getStatusMessage()}
        </h3>
        
        <p className="text-gray-600 dark:text-gray-400">
          {getStatusDescription()}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Imported */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircleIcon className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {result.importedCount}
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">
                Imported
              </div>
            </div>
          </div>
        </div>

        {/* Skipped */}
        {result.skippedCount > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-500 mr-3" />
              <div>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {result.skippedCount}
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  Skipped
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Errors */}
        {result.errorCount > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center">
              <XCircleIcon className="h-8 w-8 text-red-500 mr-3" />
              <div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {result.errorCount}
                </div>
                <div className="text-sm text-red-700 dark:text-red-300">
                  Failed
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Duplicates */}
      {result.duplicates.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            Duplicate Problems Skipped ({result.duplicates.length})
          </h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {result.duplicates.map((title, index) => (
              <p key={index} className="text-xs text-yellow-700 dark:text-yellow-300">
                • {title}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Issues ({result.errors.length})
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {result.errors.map((error, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border text-sm ${
                  error.severity === 'error'
                    ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
                    : 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200'
                }`}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 mr-2 mt-0.5">
                    {error.severity === 'error' ? (
                      <XCircleIcon className="h-4 w-4" />
                    ) : (
                      <ExclamationTriangleIcon className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {error.field ? `${error.field}: ` : ''}{error.message}
                    </p>
                    {error.line > 0 && (
                      <p className="text-xs opacity-75 mt-1">
                        Line {error.line}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Message */}
      {result.success && result.importedCount > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex">
            <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                Import Successful!
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {result.importedCount} problem{result.importedCount !== 1 ? 's' : ''} have been added to your collection. 
                You can now find them in your problems list.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {result.success ? 'Import completed' : 'Some issues occurred during import'}
        </div>
        
        <div className="flex items-center space-x-3">
          {onRetry && !result.success && (
            <button
              onClick={onRetry}
              className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              Try Again
            </button>
          )}
          
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            {result.success ? 'Done' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}