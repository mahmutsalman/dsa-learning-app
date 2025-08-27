// Answer Card Debug Logger
//
// Specialized debug logging service for answer card functionality.
// Logs to file in src-tauri/dev-data/debug/ for analysis.

import { invoke } from '@tauri-apps/api/core';

interface DebugLogEntry {
  timestamp: string;
  category: string;
  action: string;
  data: any;
  context?: any;
}

export class AnswerCardDebugLogger {
  private static readonly DEBUG_FILE = 'src-tauri/dev-data/debug/answer-card-debug.txt';
  private static isEnabled = true; // Enable for debugging session

  /**
   * Log answer card operation with timestamp and context
   */
  static async log(category: string, action: string, data: any, context?: any) {
    if (!this.isEnabled) return;

    const entry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      category,
      action,
      data,
      context
    };

    const logLine = this.formatLogEntry(entry);
    
    try {
      await invoke('append_to_file', {
        path: await invoke('get_absolute_path', { relativePath: this.DEBUG_FILE }),
        content: logLine + '\n'
      });
      
      // Also log to console for immediate feedback
      console.debug(`[AnswerCard] ${category}.${action}:`, data, context ? `Context: ${JSON.stringify(context)}` : '');
    } catch (error) {
      console.error('Failed to write answer card debug log:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Log frontend state changes
   */
  static async logStateChange(component: string, stateName: string, oldValue: any, newValue: any, context?: any) {
    await this.log('State', 'Change', {
      component,
      stateName,
      oldValue: this.safeStringify(oldValue),
      newValue: this.safeStringify(newValue),
      changed: !this.isEqual(oldValue, newValue)
    }, context);
  }

  /**
   * Log user interactions
   */
  static async logUserAction(action: string, data: any, context?: any) {
    await this.log('User', action, data, context);
  }

  /**
   * Log API calls
   */
  static async logApiCall(method: string, params: any, response: any, context?: any) {
    await this.log('API', method, {
      params: this.safeStringify(params),
      response: this.safeStringify(response),
      success: response?.success !== false
    }, context);
  }

  /**
   * Log solution card workflow steps
   */
  static async logSolutionFlow(step: string, data: any, context?: any) {
    await this.log('SolutionFlow', step, data, context);
  }

  /**
   * Log editor state changes
   */
  static async logEditorChange(editorType: string, data: any, context?: any) {
    await this.log('Editor', editorType, {
      codeLength: data.code?.length || 0,
      notesLength: data.notes?.length || 0,
      language: data.language,
      hasContent: !!(data.code || data.notes)
    }, context);
  }

  /**
   * Clear debug log file for new session
   */
  static async clearLog() {
    if (!this.isEnabled) return;

    try {
      await invoke('write_file', {
        path: await invoke('get_absolute_path', { relativePath: this.DEBUG_FILE }),
        content: `=== Answer Card Debug Log ===\nNew session started at: ${new Date().toISOString()}\n\n`
      });
      console.log('Answer card debug log cleared');
    } catch (error) {
      console.error('Failed to clear answer card debug log:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Enable/disable debug logging
   */
  static setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    console.log(`Answer card debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Format log entry for readable output
   */
  private static formatLogEntry(entry: DebugLogEntry): string {
    const contextStr = entry.context ? ` | Context: ${this.safeStringify(entry.context)}` : '';
    return `[${entry.timestamp}] ${entry.category}.${entry.action}: ${this.safeStringify(entry.data)}${contextStr}`;
  }

  /**
   * Safe JSON stringify with error handling
   */
  private static safeStringify(obj: any): string {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    
    try {
      return JSON.stringify(obj, this.jsonReplacer, 2);
    } catch (error) {
      return `[JSON Error: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  /**
   * JSON replacer to handle circular references and functions
   */
  private static jsonReplacer(_key: string, value: any): any {
    if (typeof value === 'function') {
      return `[Function: ${value.name || 'anonymous'}]`;
    }
    if (value instanceof Date) {
      return `[Date: ${value.toISOString()}]`;
    }
    if (value instanceof Error) {
      return `[Error: ${value.message}]`;
    }
    // Handle circular references
    if (typeof value === 'object' && value !== null) {
      if (this.seenObjects?.has(value)) {
        return '[Circular Reference]';
      }
      this.seenObjects = this.seenObjects || new WeakSet();
      this.seenObjects.add(value);
    }
    return value;
  }

  private static seenObjects?: WeakSet<object>;

  /**
   * Simple equality check for logging purposes
   */
  private static isEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
}

// Convenient exports for specific logging scenarios
export const logAnswerCardState = AnswerCardDebugLogger.logStateChange.bind(AnswerCardDebugLogger);
export const logAnswerCardAction = AnswerCardDebugLogger.logUserAction.bind(AnswerCardDebugLogger);
export const logAnswerCardApi = AnswerCardDebugLogger.logApiCall.bind(AnswerCardDebugLogger);
export const logSolutionFlow = AnswerCardDebugLogger.logSolutionFlow.bind(AnswerCardDebugLogger);
export const logEditorChange = AnswerCardDebugLogger.logEditorChange.bind(AnswerCardDebugLogger);