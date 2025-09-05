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
  timing?: TimingInfo;
  performance?: PerformanceInfo;
}

interface TimingInfo {
  startTime?: number;
  endTime?: number;
  duration?: number;
  operationId?: string;
}

interface PerformanceInfo {
  memoryUsage?: number;
  renderCount?: number;
  apiResponseTime?: number;
  editorChangeLatency?: number;
}


export class AnswerCardDebugLogger {
  private static readonly DEBUG_FILE = 'src-tauri/dev-data/debug/answer-card-debug.txt';
  private static isEnabled = true; // Enable for debugging session
  private static operationTimers = new Map<string, number>();
  private static renderCounters = new Map<string, number>();
  private static lastLogTime = 0; // Throttle frequent logging
  private static logCounter = 0;
  private static performanceBaseline = {
    apiResponseTime: 1000, // 1 second baseline
    editorChangeLatency: 100, // 100ms baseline
    memoryUsage: 50 * 1024 * 1024, // 50MB baseline
  };

  /**
   * Log answer card operation with timestamp, timing, and context (throttled)
   */
  static async log(category: string, action: string, data: any, context?: any, timing?: TimingInfo, performance?: PerformanceInfo) {
    if (!this.isEnabled) return;

    // Throttle frequent logging - only log every 500ms for editor changes
    const now = Date.now();
    const isEditorLog = category.includes('Editor') || action.includes('Editor');
    
    if (isEditorLog) {
      this.logCounter++;
      // Only log every 10th editor change or if 2 seconds have passed
      if (this.logCounter % 10 !== 0 && (now - this.lastLogTime) < 2000) {
        return;
      }
    }
    
    this.lastLogTime = now;

    const entry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      category,
      action,
      data,
      context,
      timing,
      performance
    };

    const logLine = this.formatLogEntry(entry);
    
    try {
      await invoke('append_to_file', {
        path: await invoke('get_absolute_path', { relativePath: this.DEBUG_FILE }),
        content: logLine + '\n'
      });
      
      // Also log to console for immediate feedback (less verbose for editor changes)
      if (isEditorLog) {
        console.debug(`[AnswerCard] ${category}.${action}: (${this.logCounter})`, 
          typeof data === 'object' ? `Length: ${data.codeLength || 0}/${data.notesLength || 0}` : data);
      } else {
        console.debug(`[AnswerCard] ${category}.${action}:`, data, context ? `Context: ${JSON.stringify(context)}` : '');
      }
    } catch (error) {
      console.error('Failed to write answer card debug log:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Log frontend state changes with enhanced analysis
   */
  static async logStateChange(component: string, stateName: string, oldValue: any, newValue: any, context?: any, timing?: TimingInfo) {
    const changedFields = this.getChangedFields(oldValue, newValue);
    const changeAnalysis = this.analyzeStateChange(oldValue, newValue);
    
    await this.log('State', 'Change', {
      component,
      stateName,
      oldValue: this.safeStringify(oldValue),
      newValue: this.safeStringify(newValue),
      changed: !this.isEqual(oldValue, newValue),
      changedFields,
      changeAnalysis
    }, context, timing);
  }

  /**
   * Log user interactions
   */
  static async logUserAction(action: string, data: any, context?: any) {
    await this.log('User', action, data, context);
  }

  /**
   * Log API calls with enhanced performance analysis
   */
  static async logApiCall(method: string, params: any, response: any, context?: any, timing?: TimingInfo) {
    const performance: PerformanceInfo = {};
    
    if (timing?.duration) {
      performance.apiResponseTime = timing.duration;
    }
    
    const isSlowResponse = timing?.duration && timing.duration > this.performanceBaseline.apiResponseTime;
    const successStatus = this.analyzeApiResponse(response);
    
    await this.log('API', method, {
      params: this.safeStringify(params),
      response: this.safeStringify(response),
      success: successStatus.success,
      statusCode: successStatus.statusCode,
      errorType: successStatus.errorType,
      isSlowResponse,
      performanceWarning: isSlowResponse ? `API call took ${timing?.duration}ms (baseline: ${this.performanceBaseline.apiResponseTime}ms)` : null
    }, context, timing, performance);
  }

  /**
   * Log solution card workflow steps
   */
  static async logSolutionFlow(step: string, data: any, context?: any) {
    await this.log('SolutionFlow', step, data, context);
  }

  /**
   * Log editor state changes with before/after analysis
   */
  static async logEditorChange(editorType: string, data: any, context?: any, timing?: TimingInfo, beforeData?: any) {
    const performance: PerformanceInfo = {};
    
    if (timing?.duration) {
      performance.editorChangeLatency = timing.duration;
    }
    
    const isSlowChange = timing?.duration && timing.duration > this.performanceBaseline.editorChangeLatency;
    const contentAnalysis = this.analyzeEditorContent(data, beforeData);
    
    await this.log('Editor', editorType, {
      codeLength: data.code?.length || 0,
      notesLength: data.notes?.length || 0,
      language: data.language,
      hasContent: !!(data.code || data.notes),
      beforeData: beforeData ? {
        codeLength: beforeData.code?.length || 0,
        notesLength: beforeData.notes?.length || 0,
        language: beforeData.language
      } : null,
      contentAnalysis,
      isSlowChange,
      performanceWarning: isSlowChange ? `Editor change took ${timing?.duration}ms (baseline: ${this.performanceBaseline.editorChangeLatency}ms)` : null
    }, context, timing, performance);
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
   * Format log entry for readable output with enhanced information
   */
  private static formatLogEntry(entry: DebugLogEntry): string {
    const parts: string[] = [`[${entry.timestamp}]`];
    
    // Category and action
    parts.push(`${entry.category}.${entry.action}:`);
    
    // Main data
    parts.push(this.safeStringify(entry.data));
    
    // Timing information
    if (entry.timing) {
      const timingParts: string[] = [];
      if (entry.timing.duration !== undefined) {
        timingParts.push(`${entry.timing.duration}ms`);
      }
      if (entry.timing.operationId) {
        timingParts.push(`Op:${entry.timing.operationId}`);
      }
      if (timingParts.length > 0) {
        parts.push(`| Timing: ${timingParts.join(', ')}`);
      }
    }
    
    // Performance information
    if (entry.performance) {
      const perfParts: string[] = [];
      if (entry.performance.apiResponseTime !== undefined) {
        perfParts.push(`API:${entry.performance.apiResponseTime}ms`);
      }
      if (entry.performance.editorChangeLatency !== undefined) {
        perfParts.push(`Editor:${entry.performance.editorChangeLatency}ms`);
      }
      if (entry.performance.renderCount !== undefined) {
        perfParts.push(`Renders:${entry.performance.renderCount}`);
      }
      if (entry.performance.memoryUsage !== undefined) {
        perfParts.push(`Memory:${Math.round(entry.performance.memoryUsage / 1024 / 1024)}MB`);
      }
      if (perfParts.length > 0) {
        parts.push(`| Performance: ${perfParts.join(', ')}`);
      }
    }
    
    // Context information
    if (entry.context) {
      parts.push(`| Context: ${this.safeStringify(entry.context)}`);
    }
    
    return parts.join(' ');
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

  /**
   * Start timing an operation
   */
  static startTiming(operationId: string): void {
    this.operationTimers.set(operationId, performance.now());
  }

  /**
   * End timing an operation and return timing info
   */
  static endTiming(operationId: string): TimingInfo | undefined {
    const startTime = this.operationTimers.get(operationId);
    if (startTime === undefined) return undefined;
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    this.operationTimers.delete(operationId);
    
    return {
      startTime,
      endTime,
      duration,
      operationId
    };
  }

  /**
   * Track React component render count
   */
  static trackRender(componentName: string): number {
    const current = this.renderCounters.get(componentName) || 0;
    const newCount = current + 1;
    this.renderCounters.set(componentName, newCount);
    return newCount;
  }

  /**
   * Get memory usage information
   */
  static getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Analyze state change to identify what changed
   */
  private static analyzeStateChange(oldValue: any, newValue: any): any {
    if (oldValue === newValue) return { hasChanges: false };
    
    const analysis: any = { hasChanges: true };
    
    if (typeof oldValue === 'object' && typeof newValue === 'object' && oldValue && newValue) {
      const oldKeys = Object.keys(oldValue);
      const newKeys = Object.keys(newValue);
      
      analysis.addedKeys = newKeys.filter(key => !oldKeys.includes(key));
      analysis.removedKeys = oldKeys.filter(key => !newKeys.includes(key));
      analysis.modifiedKeys = oldKeys.filter(key => 
        newKeys.includes(key) && !this.isEqual(oldValue[key], newValue[key])
      );
    } else {
      analysis.typeChange = {
        from: typeof oldValue,
        to: typeof newValue
      };
    }
    
    return analysis;
  }

  /**
   * Get list of changed fields between two objects
   */
  private static getChangedFields(oldValue: any, newValue: any): string[] {
    if (typeof oldValue !== 'object' || typeof newValue !== 'object' || !oldValue || !newValue) {
      return oldValue !== newValue ? ['<value>'] : [];
    }
    
    const changed: string[] = [];
    const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
    
    for (const key of allKeys) {
      if (!this.isEqual(oldValue[key], newValue[key])) {
        changed.push(key);
      }
    }
    
    return changed;
  }

  /**
   * Analyze API response for success/failure details
   */
  private static analyzeApiResponse(response: any): { success: boolean; statusCode?: number; errorType?: string } {
    if (response === null || response === undefined) {
      return { success: false, errorType: 'null_response' };
    }
    
    // Check for explicit success field
    if (response.success !== undefined) {
      return {
        success: response.success,
        statusCode: response.statusCode,
        errorType: response.success ? undefined : (response.errorType || 'api_error')
      };
    }
    
    // Check for error field
    if (response.error) {
      return { success: false, errorType: 'error_field' };
    }
    
    // Check for HTTP status codes
    if (response.status || response.statusCode) {
      const status = response.status || response.statusCode;
      return {
        success: status >= 200 && status < 300,
        statusCode: status,
        errorType: status >= 200 && status < 300 ? undefined : 'http_error'
      };
    }
    
    // Default to success if we have data
    return { success: true };
  }

  /**
   * Analyze editor content changes
   */
  private static analyzeEditorContent(newData: any, oldData?: any): any {
    const analysis: any = {
      hasContent: !!(newData.code || newData.notes),
      codeLength: newData.code?.length || 0,
      notesLength: newData.notes?.length || 0
    };
    
    if (oldData) {
      const oldCodeLength = oldData.code?.length || 0;
      const oldNotesLength = oldData.notes?.length || 0;
      
      analysis.changes = {
        codeChange: (newData.code?.length || 0) - oldCodeLength,
        notesChange: (newData.notes?.length || 0) - oldNotesLength,
        languageChanged: oldData.language !== newData.language
      };
      
      analysis.changeType = [];
      if (analysis.changes.codeChange !== 0) analysis.changeType.push('code');
      if (analysis.changes.notesChange !== 0) analysis.changeType.push('notes');
      if (analysis.changes.languageChanged) analysis.changeType.push('language');
    }
    
    return analysis;
  }
}

// Convenient exports for specific logging scenarios
export const logAnswerCardState = AnswerCardDebugLogger.logStateChange.bind(AnswerCardDebugLogger);
export const logAnswerCardAction = AnswerCardDebugLogger.logUserAction.bind(AnswerCardDebugLogger);
export const logAnswerCardApi = AnswerCardDebugLogger.logApiCall.bind(AnswerCardDebugLogger);
export const logSolutionFlow = AnswerCardDebugLogger.logSolutionFlow.bind(AnswerCardDebugLogger);
export const logEditorChange = AnswerCardDebugLogger.logEditorChange.bind(AnswerCardDebugLogger);

// Timing and performance utilities
export const startTiming = AnswerCardDebugLogger.startTiming.bind(AnswerCardDebugLogger);
export const endTiming = AnswerCardDebugLogger.endTiming.bind(AnswerCardDebugLogger);
export const trackRender = AnswerCardDebugLogger.trackRender.bind(AnswerCardDebugLogger);
export const getMemoryUsage = AnswerCardDebugLogger.getMemoryUsage.bind(AnswerCardDebugLogger);