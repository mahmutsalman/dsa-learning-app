// Comprehensive Debug Logger
// Logs frontend operations, backend calls, and database verification

import { invoke } from '@tauri-apps/api/core';

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  operation: string;
  component: 'FRONTEND' | 'BACKEND' | 'DATABASE';
  details: Record<string, any>;
  stage: string;
  success?: boolean;
  error?: string;
  executionTime?: number;
}

class ComprehensiveLogger {
  private logBuffer: LogEntry[] = [];
  private isWriting = false;

  private formatTimestamp(): string {
    const now = new Date();
    return `${now.toISOString().replace('T', ' ').replace('Z', '')} (${now.getTime()})`;
  }

  private async writeToFile() {
    if (this.isWriting || this.logBuffer.length === 0) return;

    this.isWriting = true;

    try {
      const logEntries = this.logBuffer.splice(0);
      const logLines = logEntries.map(entry => {
        const { timestamp, level, operation, component, details, stage, success, error, executionTime } = entry;

        let logLine = `[${timestamp}] ${level} ${component} | ${operation} - ${stage}`;

        if (success !== undefined) {
          logLine += ` | ${success ? '✅ SUCCESS' : '❌ FAILED'}`;
        }

        if (executionTime !== undefined) {
          logLine += ` | ${executionTime}ms`;
        }

        if (error) {
          logLine += `\n    ERROR: ${error}`;
        }

        if (Object.keys(details).length > 0) {
          logLine += `\n    DETAILS: ${JSON.stringify(details, null, 2)}`;
        }

        return logLine;
      }).join('\n\n');

      const logFileName = `comprehensive-debug-${new Date().toISOString().split('T')[0]}.log`;
      const logPath = `/Users/mahmutsalman/Documents/MyCodingProjects/Projects/Efficinecy apps/LearningApps/DSALearningApp/localResources/logFolder/${logFileName}`;

      const contentToAppend = logLines + '\n\n';

      try {
        await invoke('append_to_file', {
          path: logPath,
          content: contentToAppend
        });
      } catch (error) {
        const newFileContent = `=== Comprehensive Debug Log Started at ${this.formatTimestamp()} ===\n\n${contentToAppend}`;
        await invoke('write_file', {
          path: logPath,
          content: newFileContent
        });
      }

    } catch (error) {
      console.error('Failed to write comprehensive log:', error);
    } finally {
      this.isWriting = false;
    }
  }

  async log(entry: Omit<LogEntry, 'timestamp'>): Promise<void> {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: this.formatTimestamp(),
    };

    this.logBuffer.push(logEntry);
    setTimeout(() => this.writeToFile(), 10);
  }

  // Frontend logging methods
  async logFrontendOperation(operation: string, stage: string, details: Record<string, any>, success?: boolean, error?: string, executionTime?: number) {
    await this.log({
      level: success === false ? 'ERROR' : 'INFO',
      operation,
      component: 'FRONTEND',
      stage,
      details,
      success,
      error,
      executionTime
    });
  }

  // Backend API call logging
  async logBackendCall(operation: string, requestData: Record<string, any>, response?: Record<string, any>, success?: boolean, error?: string, executionTime?: number) {
    await this.log({
      level: success === false ? 'ERROR' : 'INFO',
      operation,
      component: 'BACKEND',
      stage: 'API_CALL',
      details: {
        request: requestData,
        response: response || null
      },
      success,
      error,
      executionTime
    });
  }

  // Database verification logging
  async logDatabaseVerification(operation: string, cardId: string, expectedData: Record<string, any>, actualData?: Record<string, any>, success?: boolean, error?: string) {
    await this.log({
      level: success === false ? 'ERROR' : 'INFO',
      operation,
      component: 'DATABASE',
      stage: 'VERIFICATION',
      details: {
        cardId,
        expected: expectedData,
        actual: actualData || null,
        matches: actualData ? JSON.stringify(actualData) === JSON.stringify(expectedData) : false
      },
      success,
      error
    });
  }

  // Answer card specific methods
  async logAnswerCardAutoSave(cardId: string, field: 'code' | 'notes', content: string, startTime: number) {
    const executionTime = Date.now() - startTime;

    // Log frontend initiation
    await this.logFrontendOperation(
      'ANSWER_CARD_AUTO_SAVE',
      'INITIATED',
      {
        cardId,
        field,
        contentLength: content.length,
        contentPreview: content.substring(0, 50) + (content.length > 50 ? '...' : '')
      }
    );

    return executionTime;
  }

  async logAnswerCardAutoSaveComplete(cardId: string, field: 'code' | 'notes', content: string, success: boolean, error?: string, executionTime?: number) {
    // Log backend response
    await this.logBackendCall(
      'UPDATE_SOLUTION_CARD',
      { cardId, field, contentLength: content.length },
      { success },
      success,
      error,
      executionTime
    );

    if (success) {
      // Verify in database
      await this.verifyAnswerCardInDatabase(cardId, field, content);
    }
  }

  async verifyAnswerCardInDatabase(cardId: string, field: 'code' | 'notes', expectedContent: string) {
    try {
      // const startTime = Date.now();

      // Query database directly to verify content was saved
      const query = `SELECT id, code, notes, language, last_modified FROM cards WHERE id = '${cardId}' AND is_solution = 1`;

      // Use backend command to query database
      const result = await invoke('execute_sql_query', {
        query
      }).catch((error) => {
        console.error('Database query failed:', error);
        return null;
      });

      // const executionTime = Date.now() - startTime;

      if (result && Array.isArray(result) && result.length > 0) {
        const row = result[0];
        const actualContent = field === 'code' ? (row.code || '') : (row.notes || '');
        const matches = actualContent === expectedContent;

        await this.logDatabaseVerification(
          'VERIFY_ANSWER_CARD_SAVE',
          cardId,
          { [field]: expectedContent },
          {
            [field]: actualContent,
            lastModified: row.last_modified,
            queryResult: row
          },
          matches,
          matches ? undefined : `Expected "${expectedContent}" but got "${actualContent}"`
        );
      } else {
        await this.logDatabaseVerification(
          'VERIFY_ANSWER_CARD_SAVE',
          cardId,
          { [field]: expectedContent },
          { queryResult: result },
          false,
          result ? 'No rows returned' : 'Database query failed'
        );
      }
    } catch (error) {
      await this.logDatabaseVerification(
        'VERIFY_ANSWER_CARD_SAVE',
        cardId,
        { [field]: expectedContent },
        undefined,
        false,
        `Database verification failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // Mode switching logging
  async logModeSwitch(fromMode: string, toMode: string, cardId: string, contentSnapshot: Record<string, any>) {
    await this.logFrontendOperation(
      'ANSWER_MODE_SWITCH',
      `${fromMode}_TO_${toMode}`,
      {
        cardId,
        contentSnapshot
      }
    );
  }
}

// Export singleton instance
export const comprehensiveLogger = new ComprehensiveLogger();