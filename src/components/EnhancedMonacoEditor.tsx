import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';

export interface EnhancedMonacoEditorProps {
  value: string;
  language: string;
  theme: 'vs-dark' | 'vs-light';
  onChange: (value: string) => void;
  onSave: () => void;
  onMount?: (editor: any) => void;
  className?: string;
}

// Monaco Editor options optimized for react-resizable-panels
const EDITOR_OPTIONS = {
  selectOnLineNumbers: true,
  roundedSelection: false,
  readOnly: false,
  cursorStyle: 'line' as const,
  automaticLayout: false, // We'll handle layout manually
  minimap: {
    enabled: true,
    scale: 1
  },
  scrollBeyondLastLine: false,
  fontSize: 14,
  fontFamily: 'Fira Code, SF Mono, Monaco, Inconsolata, "Roboto Mono", Consolas, "Courier New", monospace',
  lineHeight: 20,
  letterSpacing: 0.5,
  wordWrap: 'on' as const,
  wordWrapColumn: 80,
  wordWrapMinified: true,
  wrappingIndent: 'indent' as const,
  wrappingStrategy: 'advanced' as const,
  contextmenu: true,
  copyWithSyntaxHighlighting: true,
  multiCursorModifier: 'ctrlCmd' as const,
  quickSuggestions: {
    other: true,
    comments: true,
    strings: true
  },
  acceptSuggestionOnCommitCharacter: true,
  acceptSuggestionOnEnter: 'on' as const,
  accessibilitySupport: 'auto' as const,
  autoIndent: 'full' as const,
  formatOnPaste: true,
  formatOnType: true,
  renderLineHighlight: 'line' as const,
  renderWhitespace: 'selection' as const,
  rulers: [80, 120],
  showFoldingControls: 'always' as const,
  smoothScrolling: true,
  suggestOnTriggerCharacters: true,
  tabCompletion: 'on' as const,
  wordBasedSuggestions: 'matchingDocuments' as const,
  bracketPairColorization: {
    enabled: true
  },
  guides: {
    bracketPairs: false,    // Disables the connecting lines
    indentation: true       // Keeps indentation guides
  }
};

const SUPPORTED_LANGUAGES = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
  php: 'php',
  ruby: 'ruby',
  swift: 'swift',
  kotlin: 'kotlin'
};

/**
 * Enhanced Monaco Editor component for use with react-resizable-panels
 * Uses explicit height calculation to avoid layout issues with percentage-based heights
 */
export function EnhancedMonacoEditor({
  value,
  language,
  theme,
  onChange,
  onSave,
  onMount,
  className = ''
}: EnhancedMonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const [editorHeight, setEditorHeight] = useState<number>(400);
  const [isReady, setIsReady] = useState(false);

  // Track container dimensions and update editor height
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const computedStyle = getComputedStyle(containerRef.current);
        
        // Account for container padding and borders
        const paddingTop = parseInt(computedStyle.paddingTop) || 0;
        const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;
        const borderTop = parseInt(computedStyle.borderTopWidth) || 0;
        const borderBottom = parseInt(computedStyle.borderBottomWidth) || 0;
        
        const totalVerticalOffset = paddingTop + paddingBottom + borderTop + borderBottom;
        const availableHeight = rect.height - totalVerticalOffset;
        const newHeight = Math.max(availableHeight, 200); // Minimum 200px height
        
        // Debug logging (can be removed in production)
        // console.log('Monaco Editor Dimensions:', {
        //   containerHeight: rect.height,
        //   totalOffset: totalVerticalOffset,
        //   availableHeight,
        //   finalHeight: newHeight
        // });
        
        if (Math.abs(newHeight - editorHeight) > 1) { // Only update if significant change
          setEditorHeight(newHeight);
          
          // Layout editor if it's mounted
          if (editorRef.current) {
            setTimeout(() => {
              editorRef.current?.layout();
            }, 10);
          }
        }
      }
    };

    // Initial measurement
    updateDimensions();
    setIsReady(true);

    // Use ResizeObserver for efficient dimension tracking
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    resizeObserver.observe(containerRef.current);

    // Also listen for window events as fallback
    window.addEventListener('resize', updateDimensions);
    window.addEventListener('workspace-layout-change', updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('workspace-layout-change', updateDimensions);
    };
  }, [editorHeight]);

  const handleEditorMount = useCallback((editor: any, monaco: Monaco) => {
    editorRef.current = editor;

    // Configure Ctrl+S shortcut for manual save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });

    // Language-specific configurations
    if (language === 'typescript' || language === 'javascript') {
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.Latest,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        reactNamespace: 'React',
        allowJs: true,
        typeRoots: ['node_modules/@types']
      });

      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false
      });
    }

    // Configure Python language features
    if (language === 'python') {
      monaco.languages.registerCompletionItemProvider('python', {
        provideCompletionItems: (model, position) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn
          };
          
          return {
            suggestions: [
              {
                label: 'def',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: 'def ${1:function_name}(${2:args}):\n\t${3:pass}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Define a function',
                range: range
              },
              {
                label: 'class',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: 'class ${1:ClassName}:\n\t${2:pass}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Define a class',
                range: range
              }
            ]
          };
        }
      });
    }

    // Initial layout
    setTimeout(() => {
      editor.layout();
    }, 50);

    // Focus the editor
    editor.focus();

    // Call additional mount callback if provided
    onMount?.(editor);
  }, [onSave, onMount, language]);

  const handleEditorChange = useCallback((newValue: string | undefined) => {
    onChange(newValue || '');
  }, [onChange]);

  // Get Monaco-compatible language
  const monacoLanguage = SUPPORTED_LANGUAGES[language as keyof typeof SUPPORTED_LANGUAGES] || 'plaintext';

  return (
    <div 
      ref={containerRef} 
      className={`enhanced-monaco-editor h-full w-full ${className}`}
    >
      {isReady ? (
        <Editor
          height={editorHeight}
          language={monacoLanguage}
          value={value}
          theme={theme}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          options={EDITOR_OPTIONS}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          }
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      )}
    </div>
  );
}