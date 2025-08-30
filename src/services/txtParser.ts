import { ParsedProblem, ImportError, ParseResult } from '../components/ProblemImporter/types';

interface ParseContext {
  lines: string[];
  currentLine: number;
  currentProblem: Partial<ParsedProblem>;
  problems: ParsedProblem[];
  errors: ImportError[];
  currentField: string | null;
  fieldContent: string[];
}

export async function parseTxtFile(file: File): Promise<ParseResult> {
  const text = await file.text();
  const lines = text.split('\n').map(line => line.trim());
  
  const context: ParseContext = {
    lines,
    currentLine: 0,
    currentProblem: {},
    problems: [],
    errors: [],
    currentField: null,
    fieldContent: []
  };

  while (context.currentLine < lines.length) {
    const line = lines[context.currentLine];
    
    // Skip empty lines
    if (line === '') {
      context.currentLine++;
      continue;
    }
    
    // Check for problem delimiter
    if (line === '---') {
      finalizeProblem(context);
      context.currentLine++;
      continue;
    }
    
    // Check for field headers
    if (line.startsWith('# ')) {
      processFieldHeader(context, line);
    } else {
      // Content line for current field
      processContentLine(context, line);
    }
    
    context.currentLine++;
  }
  
  // Finalize the last problem if exists
  if (Object.keys(context.currentProblem).length > 0) {
    finalizeProblem(context);
  }

  return {
    problems: context.problems,
    errors: context.errors,
    totalProblems: context.problems.length + context.errors.filter(e => e.severity === 'error').length,
    validProblems: context.problems.length
  };
}

function processFieldHeader(context: ParseContext, line: string) {
  // Finalize previous field content
  if (context.currentField) {
    setFieldValue(context, context.currentField, context.fieldContent.join('\n').trim());
    context.fieldContent = [];
  }
  
  // Parse new field header
  const match = line.match(/^# ([^:]+):\s*(.*)$/);
  if (!match) {
    context.errors.push({
      line: context.currentLine + 1,
      message: 'Invalid field header format. Expected "# Field: value"',
      severity: 'warning'
    });
    return;
  }
  
  const fieldName = match[1].toLowerCase().trim();
  const fieldValue = match[2].trim();
  
  context.currentField = fieldName;
  
  // If field has immediate value, add it
  if (fieldValue) {
    context.fieldContent.push(fieldValue);
  }
}

function processContentLine(context: ParseContext, line: string) {
  if (context.currentField) {
    context.fieldContent.push(line);
  } else {
    // Content without field header
    context.errors.push({
      line: context.currentLine + 1,
      message: 'Content found without field header',
      severity: 'warning'
    });
  }
}

function setFieldValue(context: ParseContext, fieldName: string, content: string) {
  const problem = context.currentProblem;
  
  switch (fieldName) {
    case 'title':
      problem.title = content;
      break;
      
    case 'description':
      problem.description = content;
      break;
      
    case 'difficulty':
      const difficulty = parseDifficulty(content);
      if (difficulty) {
        problem.difficulty = difficulty;
      } else {
        context.errors.push({
          line: context.currentLine + 1,
          field: 'difficulty',
          message: `Invalid difficulty "${content}". Must be Easy, Medium, or Hard`,
          severity: 'error'
        });
        problem.difficulty = 'Medium'; // Default fallback
      }
      break;
      
    case 'topics':
      problem.topics = parseCommaSeparatedList(content);
      break;
      
    case 'tags':
      problem.tags = parseCommaSeparatedList(content);
      break;
      
    case 'leetcode url':
    case 'url':
      if (isValidUrl(content)) {
        problem.leetcodeUrl = content;
      } else {
        context.errors.push({
          line: context.currentLine + 1,
          field: 'leetcodeUrl',
          message: `Invalid URL format: "${content}"`,
          severity: 'warning'
        });
      }
      break;
      
    case 'constraints':
      problem.constraints = parseBulletList(content);
      break;
      
    case 'hints':
      problem.hints = parseBulletList(content);
      break;
      
    case 'related':
    case 'related problems':
      problem.relatedProblems = parseCommaSeparatedList(content);
      break;
      
    default:
      context.errors.push({
        line: context.currentLine + 1,
        field: fieldName,
        message: `Unknown field "${fieldName}"`,
        severity: 'warning'
      });
  }
}

function finalizeProblem(context: ParseContext) {
  // Finalize current field content
  if (context.currentField && context.fieldContent.length > 0) {
    setFieldValue(context, context.currentField, context.fieldContent.join('\n').trim());
  }
  
  const problem = context.currentProblem;
  
  // Reset for next problem
  context.currentProblem = {};
  context.currentField = null;
  context.fieldContent = [];
  
  // Validate required fields
  const requiredFields = ['title', 'description', 'difficulty'];
  const missingFields = requiredFields.filter(field => !problem[field as keyof ParsedProblem]);
  
  if (missingFields.length > 0) {
    context.errors.push({
      line: context.currentLine + 1,
      message: `Problem missing required fields: ${missingFields.join(', ')}`,
      severity: 'error'
    });
    return; // Skip this problem
  }
  
  // Set defaults for optional fields
  const completeProblem: ParsedProblem = {
    title: problem.title!,
    description: problem.description!,
    difficulty: problem.difficulty!,
    topics: problem.topics || [],
    tags: problem.tags || [],
    leetcodeUrl: problem.leetcodeUrl,
    constraints: problem.constraints || [],
    hints: problem.hints || [],
    relatedProblems: problem.relatedProblems || []
  };
  
  // Additional validation
  if (completeProblem.title.length > 200) {
    context.errors.push({
      line: context.currentLine + 1,
      field: 'title',
      message: 'Title exceeds maximum length of 200 characters',
      severity: 'warning'
    });
    completeProblem.title = completeProblem.title.substring(0, 200);
  }
  
  if (completeProblem.description.length > 5000) {
    context.errors.push({
      line: context.currentLine + 1,
      field: 'description',
      message: 'Description exceeds maximum length of 5000 characters',
      severity: 'warning'
    });
    completeProblem.description = completeProblem.description.substring(0, 5000);
  }
  
  context.problems.push(completeProblem);
}

function parseDifficulty(value: string): 'Easy' | 'Medium' | 'Hard' | null {
  const normalized = value.toLowerCase().trim();
  switch (normalized) {
    case 'easy':
      return 'Easy';
    case 'medium':
      return 'Medium';
    case 'hard':
      return 'Hard';
    default:
      return null;
  }
}

function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

function parseBulletList(value: string): string[] {
  const lines = value.split('\n');
  const items: string[] = [];
  
  // Debug logging
  console.log('🔍 [TxtParser] parseBulletList input:', JSON.stringify(value));
  console.log('🔍 [TxtParser] Split into lines:', lines.length, lines);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = normalizeWhitespace(line);
    
    console.log(`🔍 [TxtParser] Line ${i}: "${line}" -> trimmed: "${trimmed}"`);
    
    // Skip empty lines
    if (!trimmed) {
      continue;
    }
    
    // Check for various bullet point formats with robust dash detection
    const bulletMatch = detectBulletPoint(trimmed);
    if (bulletMatch) {
      const content = bulletMatch.content.trim();
      items.push(content);
      console.log(`✅ [TxtParser] Found bullet point: "${content}"`);
    } else if (trimmed.match(/^\d+\.\s/)) {
      // Numbered list item
      const content = trimmed.replace(/^\d+\.\s/, '').trim();
      items.push(content);
      console.log(`✅ [TxtParser] Found numbered item: "${content}"`);
    } else if (items.length === 0) {
      // First line without bullet format, treat as single item
      items.push(trimmed);
      console.log(`✅ [TxtParser] First line without bullet: "${trimmed}"`);
    } else if (shouldTreatAsContinuation(trimmed, line, i, lines)) {
      // Continuation of previous item - be more selective
      items[items.length - 1] += ' ' + trimmed;
      console.log(`📝 [TxtParser] Continuation: added to previous item`);
    } else {
      // Looks like it should be a separate item even without bullet format
      items.push(trimmed);
      console.log(`⚠️ [TxtParser] Treated as separate item without bullet: "${trimmed}"`);
    }
  }
  
  const filteredItems = items
    .map(item => item.trim())
    .filter(item => item.length > 0)
    .filter(item => item.length <= 500); // Max length per item
  
  console.log('✅ [TxtParser] Final items:', filteredItems);
  return filteredItems;
}

// Helper function to normalize whitespace and handle various character encodings
function normalizeWhitespace(text: string): string {
  return text
    .replace(/[\u00A0\u2007\u202F]/g, ' ') // Replace non-breaking spaces with regular spaces
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .trim();
}

// Enhanced bullet point detection that handles various dash characters
function detectBulletPoint(text: string): { content: string } | null {
  // Various dash characters that might be used
  const dashChars = [
    '-',          // ASCII hyphen-minus (U+002D)
    '–',          // EN DASH (U+2013)
    '—',          // EM DASH (U+2014)
    '−',          // MINUS SIGN (U+2212)
    '∙',          // BULLET OPERATOR (U+2219)
    '•',          // BULLET (U+2022)
    '◦',          // WHITE BULLET (U+25E6)
    '▪',          // BLACK SMALL SQUARE (U+25AA)
    '▫',          // WHITE SMALL SQUARE (U+25AB)
    '*'           // ASTERISK (U+002A)
  ];
  
  for (const dash of dashChars) {
    // Check for "dash space" pattern
    if (text.startsWith(dash + ' ')) {
      const content = text.substring(2);
      console.log(`🎯 [TxtParser] Detected bullet with "${dash}" char: "${content}"`);
      return { content };
    }
    // Check for just dash without space (less common but possible)
    if (text.startsWith(dash) && text.length > 1 && !text.startsWith(dash + dash)) {
      const content = text.substring(1).trim();
      console.log(`🎯 [TxtParser] Detected bullet with "${dash}" char (no space): "${content}"`);
      return { content };
    }
  }
  
  return null;
}

// Smarter logic to determine if a line should be treated as continuation
function shouldTreatAsContinuation(trimmed: string, originalLine: string, _lineIndex: number, _allLines: string[]): boolean {
  // Don't treat as continuation if line looks like it could be a bullet point that we failed to detect
  if (trimmed.length > 50 && trimmed.includes(' ') && trimmed[0].match(/[a-zA-Z]/)) {
    // This looks like it starts a new sentence/thought, probably a missed bullet point
    console.log(`🚫 [TxtParser] Line looks like missed bullet point: "${trimmed}"`);
    return false;
  }
  
  // Don't treat as continuation if the original line had significant leading whitespace
  // (might indicate it's meant to be a separate item)
  const leadingWhitespace = originalLine.length - originalLine.trimStart().length;
  if (leadingWhitespace > 2) {
    console.log(`🚫 [TxtParser] Line has significant leading whitespace: ${leadingWhitespace}`);
    return false;
  }
  
  // Don't treat as continuation if line starts with common sentence starters
  const sentenceStarters = ['The', 'This', 'When', 'If', 'Use', 'Keep', 'Remember', 'Consider', 'Try', 'Again', 'Also', 'Another'];
  for (const starter of sentenceStarters) {
    if (trimmed.startsWith(starter + ' ')) {
      console.log(`🚫 [TxtParser] Line starts with sentence starter "${starter}"`);
      return false;
    }
  }
  
  // If we get here, it's probably genuinely a continuation
  return true;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}