import { useState, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { FileDropZone } from './FileDropZone';
import { ProblemPreview } from './ProblemPreview';
import { ImportProgress } from './ImportProgress';
import { ImportResults } from './ImportResults';
import { parseTxtFile } from '../../services/txtParser';
import { importProblems, importProblemsFromTxt } from '../../services/problemImportService';
import { 
  ProblemImporterProps, 
  ParsedProblem, 
  ParseResult, 
  ImportProgress as IImportProgress,
  ImportResult,
  ImportStep
} from './types';

export function ProblemImporter({ 
  isOpen, 
  onClose, 
  onImportComplete 
}: ProblemImporterProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('parsing');
  const [, setSelectedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importProgress, setImportProgress] = useState<IImportProgress>({
    currentStep: 'parsing',
    totalSteps: 4,
    currentProblem: 0,
    totalProblems: 0,
    isComplete: false,
    hasErrors: false
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useDirectImport, setUseDirectImport] = useState(true); // Use backend import by default

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setCurrentStep('parsing');
    
    try {
      if (useDirectImport) {
        // Direct backend import - skip preview step
        setCurrentStep('importing');
        setImportProgress(prev => ({
          ...prev,
          currentStep: 'importing'
        }));
        
        const content = await file.text();
        const result = await importProblemsFromTxt(content);
        
        setImportResult(result);
        setCurrentStep('complete');
        setImportProgress(prev => ({
          ...prev,
          currentStep: 'complete',
          isComplete: true,
          hasErrors: result.errorCount > 0,
          totalProblems: result.importedCount + result.skippedCount + result.errorCount
        }));
        
        onImportComplete(result);
      } else {
        // Preview mode - parse first, then show preview
        const result = await parseTxtFile(file);
        setParseResult(result);
        setCurrentStep('preview');
        setImportProgress(prev => ({
          ...prev,
          currentStep: 'preview',
          totalProblems: result.totalProblems,
          hasErrors: result.errors.length > 0
        }));
      }
    } catch (error) {
      console.error('Error processing file:', error);
      // Handle error
      const errorResult: ImportResult = {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        errors: [{
          line: 0,
          message: `Failed to process file: ${error}`,
          severity: 'error'
        }],
        duplicates: []
      };
      setImportResult(errorResult);
      setCurrentStep('complete');
      setImportProgress(prev => ({
        ...prev,
        currentStep: 'complete',
        isComplete: true,
        hasErrors: true
      }));
    } finally {
      setIsProcessing(false);
    }
  }, [useDirectImport, onImportComplete]);

  const handleImportConfirm = useCallback(async (selectedProblems: ParsedProblem[]) => {
    if (!selectedProblems.length) return;
    
    setCurrentStep('importing');
    setIsProcessing(true);

    // Update progress callback
    const onProgressUpdate = (current: number, total: number) => {
      setImportProgress(prev => ({
        ...prev,
        currentStep: 'importing',
        currentProblem: current,
        totalProblems: total
      }));
    };

    try {
      const result = await importProblems(selectedProblems, onProgressUpdate);
      setImportResult(result);
      setCurrentStep('complete');
      setImportProgress(prev => ({
        ...prev,
        currentStep: 'complete',
        isComplete: true,
        hasErrors: result.errorCount > 0
      }));
      
      onImportComplete(result);
    } catch (error) {
      console.error('Error importing problems:', error);
      // Handle import error
    } finally {
      setIsProcessing(false);
    }
  }, [onImportComplete]);

  const handleClose = useCallback(() => {
    // Reset all state when closing
    setCurrentStep('parsing');
    setSelectedFile(null);
    setParseResult(null);
    setImportResult(null);
    setIsProcessing(false);
    setImportProgress({
      currentStep: 'parsing',
      totalSteps: 4,
      currentProblem: 0,
      totalProblems: 0,
      isComplete: false,
      hasErrors: false
    });
    onClose();
  }, [onClose]);

  const handleRetry = useCallback(() => {
    setCurrentStep('parsing');
    setSelectedFile(null);
    setParseResult(null);
    setImportResult(null);
    setIsProcessing(false);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Import Problems from TXT File
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            disabled={isProcessing}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            {['File Upload', 'Preview', 'Import', 'Complete'].map((step, index) => {
              const stepIndex = index + 1;
              const isActive = 
                (currentStep === 'parsing' && stepIndex === 1) ||
                (currentStep === 'preview' && stepIndex === 2) ||
                (currentStep === 'importing' && stepIndex === 3) ||
                (currentStep === 'complete' && stepIndex === 4);
              const isComplete = 
                (currentStep === 'preview' && stepIndex === 1) ||
                (currentStep === 'importing' && stepIndex <= 2) ||
                (currentStep === 'complete' && stepIndex <= 3);

              return (
                <div key={step} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium
                    ${isComplete ? 'bg-green-500 border-green-500 text-white' : 
                      isActive ? 'border-blue-500 text-blue-500 bg-blue-50 dark:bg-blue-900' : 
                      'border-gray-300 text-gray-400 dark:border-gray-600'}
                  `}>
                    {isComplete ? '✓' : stepIndex}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-blue-600 dark:text-blue-400' : 
                    isComplete ? 'text-green-600 dark:text-green-400' :
                    'text-gray-500 dark:text-gray-400'
                  }`}>
                    {step}
                  </span>
                  {index < 3 && (
                    <div className={`mx-4 flex-1 h-0.5 ${
                      isComplete ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {currentStep === 'parsing' && (
            <>
              {/* Import Mode Toggle */}
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Import Mode
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {useDirectImport 
                        ? 'Import problems directly without preview (recommended)' 
                        : 'Preview problems before importing'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useDirectImport}
                      onChange={(e) => setUseDirectImport(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </>
          )}
          {currentStep === 'parsing' && (
            <FileDropZone 
              onFileSelect={handleFileSelect} 
              isLoading={isProcessing}
              acceptedFileTypes={['.txt']}
              maxFileSize={10} // 10MB
            />
          )}

          {currentStep === 'preview' && parseResult && (
            <ProblemPreview
              problems={parseResult.problems}
              errors={parseResult.errors}
              onImport={handleImportConfirm}
              onCancel={handleClose}
              isLoading={isProcessing}
            />
          )}

          {currentStep === 'importing' && (
            <ImportProgress
              progress={importProgress}
              onCancel={handleClose}
            />
          )}

          {currentStep === 'complete' && importResult && (
            <ImportResults
              result={importResult}
              onClose={handleClose}
              onRetry={handleRetry}
            />
          )}
        </div>
      </div>
    </div>
  );
}