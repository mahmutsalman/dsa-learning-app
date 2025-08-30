import { invoke } from '@tauri-apps/api/core';
import { ParsedProblem, ImportResult, ImportError } from '../components/ProblemImporter/types';
import { CreateProblemRequest } from '../types';

// Import problems from TXT content using Rust backend
export async function importProblemsFromTxt(content: string): Promise<ImportResult> {
  console.log('🚀 Starting TXT import with content length:', content.length);
  console.log('📝 Content preview:', content.substring(0, 200) + '...');
  
  try {
    console.log('📡 Calling Rust backend import_problems_from_txt...');
    const result = await invoke('import_problems_from_txt', { content }) as ImportResult;
    
    console.log('✅ Backend import completed successfully');
    console.log('📊 Import Result:', {
      success: result.success,
      importedCount: result.importedCount,
      skippedCount: result.skippedCount,
      errorCount: result.errorCount,
      duplicatesCount: result.duplicates?.length || 0,
      errorsCount: result.errors?.length || 0
    });
    
    if (result.errors && result.errors.length > 0) {
      console.log('⚠️ Import errors:', result.errors);
    }
    
    if (result.duplicates && result.duplicates.length > 0) {
      console.log('🔄 Duplicate problems skipped:', result.duplicates);
    }
    
    return result;
  } catch (error: any) {
    console.error('❌ Failed to import problems from TXT:', error);
    console.error('💥 Error details:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 1,
      errors: [{
        line: 0,
        message: `Failed to import problems: ${error}`,
        severity: 'error'
      }],
      duplicates: []
    };
  }
}

export async function importProblems(
  problems: ParsedProblem[],
  onProgress?: (current: number, total: number) => void
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    importedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
    duplicates: []
  };
  
  // Get existing problems to check for duplicates
  let existingProblems: any[] = [];
  try {
    existingProblems = await invoke('get_problems');
  } catch (error) {
    console.error('Failed to fetch existing problems:', error);
    result.errors.push({
      line: 0,
      message: 'Failed to fetch existing problems for duplicate checking',
      severity: 'warning'
    });
  }
  
  const existingTitles = new Set(existingProblems.map(p => p.title.toLowerCase()));
  
  // Process each problem
  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i];
    onProgress?.(i + 1, problems.length);
    
    try {
      // Check for duplicates
      if (existingTitles.has(problem.title.toLowerCase())) {
        result.duplicates.push(problem.title);
        result.skippedCount++;
        continue;
      }
      
      // Convert to backend format
      const createRequest: CreateProblemRequest = {
        title: problem.title,
        description: problem.description,
        difficulty: problem.difficulty,
        topic: problem.topics,
        leetcode_url: problem.leetcodeUrl,
        constraints: problem.constraints,
        hints: problem.hints,
        related_problem_ids: [] // Will be resolved after all problems are created
      };
      
      // Create the problem
      await invoke('create_problem', { request: createRequest });
      result.importedCount++;
      
      // Add to existing titles to prevent duplicates within the same import
      existingTitles.add(problem.title.toLowerCase());
      
    } catch (error) {
      console.error(`Failed to create problem "${problem.title}":`, error);
      result.errorCount++;
      result.errors.push({
        line: i + 1,
        field: 'import',
        message: `Failed to create problem "${problem.title}": ${error}`,
        severity: 'error'
      });
    }
  }
  
  // TODO: Handle related problems in a second pass
  // This would require mapping problem titles to IDs after creation
  
  result.success = result.errorCount === 0;
  return result;
}

export async function checkForDuplicates(problems: ParsedProblem[]): Promise<string[]> {
  try {
    const existingProblems = await invoke('get_problems') as any[];
    const existingTitles = new Set(existingProblems.map(p => p.title.toLowerCase()));
    
    return problems
      .filter(problem => existingTitles.has(problem.title.toLowerCase()))
      .map(problem => problem.title);
  } catch (error) {
    console.error('Failed to check for duplicates:', error);
    return [];
  }
}

export async function validateProblemData(problem: ParsedProblem): Promise<ImportError[]> {
  const errors: ImportError[] = [];
  
  // Title validation
  if (!problem.title || problem.title.trim().length === 0) {
    errors.push({
      line: 0,
      field: 'title',
      message: 'Title is required',
      severity: 'error'
    });
  } else if (problem.title.length > 200) {
    errors.push({
      line: 0,
      field: 'title',
      message: 'Title exceeds maximum length of 200 characters',
      severity: 'error'
    });
  }
  
  // Description validation
  if (!problem.description || problem.description.trim().length === 0) {
    errors.push({
      line: 0,
      field: 'description',
      message: 'Description is required',
      severity: 'error'
    });
  } else if (problem.description.length > 5000) {
    errors.push({
      line: 0,
      field: 'description',
      message: 'Description exceeds maximum length of 5000 characters',
      severity: 'error'
    });
  }
  
  // Difficulty validation
  if (!['Easy', 'Medium', 'Hard'].includes(problem.difficulty)) {
    errors.push({
      line: 0,
      field: 'difficulty',
      message: 'Difficulty must be Easy, Medium, or Hard',
      severity: 'error'
    });
  }
  
  // URL validation
  if (problem.leetcodeUrl) {
    try {
      new URL(problem.leetcodeUrl);
    } catch {
      errors.push({
        line: 0,
        field: 'leetcodeUrl',
        message: 'Invalid URL format',
        severity: 'warning'
      });
    }
  }
  
  // Topics validation
  if (problem.topics.length > 10) {
    errors.push({
      line: 0,
      field: 'topics',
      message: 'Too many topics (maximum 10)',
      severity: 'warning'
    });
  }
  
  // Tags validation
  if (problem.tags.length > 20) {
    errors.push({
      line: 0,
      field: 'tags',
      message: 'Too many tags (maximum 20)',
      severity: 'warning'
    });
  }
  
  // Constraints validation
  if (problem.constraints.some(c => c.length > 500)) {
    errors.push({
      line: 0,
      field: 'constraints',
      message: 'Individual constraints must be under 500 characters',
      severity: 'warning'
    });
  }
  
  // Hints validation
  if (problem.hints.some(h => h.length > 500)) {
    errors.push({
      line: 0,
      field: 'hints',
      message: 'Individual hints must be under 500 characters',
      severity: 'warning'
    });
  }
  
  return errors;
}