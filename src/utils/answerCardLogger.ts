// Answer Card Debug Logger
// Writes debug logs to local file for monitoring answer card operations

import { invoke } from '@tauri-apps/api/core';

export interface AnswerCardLogEntry {
  timestamp: string;
  event: string;
  problemId?: string;
  problemTitle?: string;
  cardId?: string;
  codeContent?: string;
  notesContent?: string;
  codeLength?: number;
  notesLength?: number;
  additionalData?: Record<string, any>;
}

class AnswerCardLogger {
  private logBuffer: AnswerCardLogEntry[] = [];
  private isWriting = false;

  private formatTimestamp(): string {
    const now = new Date();
    return `${now.toISOString().replace('T', ' ').replace('Z', '')} (${now.getTime()})`;
  }

  private async writeToFile() {
    if (this.isWriting || this.logBuffer.length === 0) return;

    this.isWriting = true;

    try {
      const logEntries = this.logBuffer.splice(0); // Clear buffer
      const logLines = logEntries.map(entry => {
        const { timestamp, event, problemId, problemTitle, cardId, codeContent, notesContent, codeLength, notesLength, additionalData } = entry;

        let logLine = `[${timestamp}] ${event}`;

        if (problemId) logLine += ` | Problem: ${problemTitle || problemId}`;
        if (cardId) logLine += ` | CardID: ${cardId}`;

        // Content lengths for overview without cluttering logs
        if (codeLength !== undefined) logLine += ` | Code: ${codeLength} chars`;
        if (notesLength !== undefined) logLine += ` | Notes: ${notesLength} chars`;

        // Add code/notes content if provided (truncated for readability)
        if (codeContent !== undefined) {
          const truncatedCode = codeContent.length > 200 ?
            codeContent.substring(0, 200) + '...[TRUNCATED]' : codeContent;
          logLine += `\n    CODE: "${truncatedCode}"`;
        }

        if (notesContent !== undefined) {
          const truncatedNotes = notesContent.length > 200 ?
            notesContent.substring(0, 200) + '...[TRUNCATED]' : notesContent;
          logLine += `\n    NOTES: "${truncatedNotes}"`;
        }

        if (additionalData) {
          logLine += `\n    DATA: ${JSON.stringify(additionalData, null, 2)}`;
        }

        return logLine;
      }).join('\n\n');

      // Append to log file in localResources/logFolder
      const logFileName = `answer-card-debug-${new Date().toISOString().split('T')[0]}.log`;
      const logPath = `/Users/mahmutsalman/Documents/MyCodingProjects/Projects/Efficinecy apps/LearningApps/DSALearningApp/localResources/logFolder/${logFileName}`;

      // Try to append to existing file, or create new file with header
      const contentToAppend = logLines + '\n\n';

      try {
        // Try to append first
        await invoke('append_to_file', {
          path: logPath,
          content: contentToAppend
        });
      } catch (error) {
        // If append fails (file doesn't exist), create new file with header
        const newFileContent = `=== Answer Card Debug Log Started at ${this.formatTimestamp()} ===\n\n${contentToAppend}`;
        await invoke('write_file', {
          path: logPath,
          content: newFileContent
        });
      }

    } catch (error) {
      console.error('Failed to write answer card log:', error);
    } finally {
      this.isWriting = false;
    }
  }

  async log(entry: Omit<AnswerCardLogEntry, 'timestamp'>): Promise<void> {
    const logEntry: AnswerCardLogEntry = {
      ...entry,
      timestamp: this.formatTimestamp(),
      // Calculate lengths if content is provided
      codeLength: entry.codeContent?.length,
      notesLength: entry.notesContent?.length,
    };

    this.logBuffer.push(logEntry);

    // Write to file asynchronously
    setTimeout(() => this.writeToFile(), 10);
  }

  // Specific logging methods for common events
  async logAnswerModeEnter(problemId: string, problemTitle: string, cardId: string, codeContent: string, notesContent: string): Promise<void> {
    await this.log({
      event: '🔄 ENTERING ANSWER MODE',
      problemId,
      problemTitle,
      cardId,
      codeContent,
      notesContent,
      additionalData: {
        action: 'mode_switch_to_answer',
        initialContentLoaded: true
      }
    });
  }

  async logAnswerCardSave(problemId: string, problemTitle: string, cardId: string, codeContent: string, notesContent: string): Promise<void> {
    await this.log({
      event: '💾 ANSWER CARD SAVE',
      problemId,
      problemTitle,
      cardId,
      codeContent,
      notesContent,
      additionalData: {
        action: 'save_answer_card',
        saveTriggered: true
      }
    });
  }

  async logAnswerModeExit(problemId: string, problemTitle: string, cardId: string, codeContent: string, notesContent: string): Promise<void> {
    await this.log({
      event: '🔄 EXITING ANSWER MODE',
      problemId,
      problemTitle,
      cardId,
      codeContent,
      notesContent,
      additionalData: {
        action: 'mode_switch_to_regular',
        contentPreserved: true
      }
    });
  }

  async logAnswerModeReopen(problemId: string, problemTitle: string, cardId: string, codeContent: string, notesContent: string): Promise<void> {
    await this.log({
      event: '🔄 REOPENING ANSWER MODE',
      problemId,
      problemTitle,
      cardId,
      codeContent,
      notesContent,
      additionalData: {
        action: 'reopen_answer_mode',
        contentRestored: true
      }
    });
  }

  async logAutoSaveTriggered(problemId: string, problemTitle: string, cardId: string, field: 'code' | 'notes', content: string): Promise<void> {
    await this.log({
      event: `⚡ ANSWER AUTO-SAVE (${field.toUpperCase()})`,
      problemId,
      problemTitle,
      cardId,
      ...(field === 'code' ? { codeContent: content } : { notesContent: content }),
      additionalData: {
        action: 'auto_save_triggered',
        field,
        timestamp: Date.now()
      }
    });
  }

  async logStateInconsistency(problemId: string, problemTitle: string, expected: any, actual: any): Promise<void> {
    await this.log({
      event: '⚠️ STATE INCONSISTENCY DETECTED',
      problemId,
      problemTitle,
      additionalData: {
        action: 'state_inconsistency',
        expected,
        actual,
        severity: 'warning'
      }
    });
  }

  async logError(event: string, error: Error, additionalContext?: Record<string, any>): Promise<void> {
    await this.log({
      event: `❌ ERROR: ${event}`,
      additionalData: {
        action: 'error',
        errorMessage: error.message,
        errorStack: error.stack,
        ...additionalContext
      }
    });
  }
}

// Export singleton instance
export const answerCardLogger = new AnswerCardLogger();