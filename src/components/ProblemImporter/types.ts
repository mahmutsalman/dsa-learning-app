// Types for the Problem Importer system

export interface ParsedProblem {
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  topics: string[];
  tags: string[];
  leetcodeUrl?: string;
  constraints: string[];
  hints: string[];
  relatedProblems: string[];
}

export interface ImportError {
  line: number;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ParseResult {
  problems: ParsedProblem[];
  errors: ImportError[];
  totalProblems: number;
  validProblems: number;
}

export interface ImportProgress {
  currentStep: ImportStep;
  totalSteps: number;
  currentProblem: number;
  totalProblems: number;
  isComplete: boolean;
  hasErrors: boolean;
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: ImportError[];
  duplicates: string[];
}

export type ImportStep = 
  | 'parsing'
  | 'validation'  
  | 'preview'
  | 'importing'
  | 'complete';

export interface ProblemImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
}

export interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in MB
}

export interface ImportProgressProps {
  progress: ImportProgress;
  onCancel?: () => void;
}

export interface ImportResultsProps {
  result: ImportResult;
  onClose: () => void;
  onRetry?: () => void;
}

export interface ProblemPreviewProps {
  problems: ParsedProblem[];
  errors: ImportError[];
  onImport: (selectedProblems: ParsedProblem[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
}