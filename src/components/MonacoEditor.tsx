import { useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { Monaco } from '@monaco-editor/react';

export interface MonacoEditorProps {
  value: string;
  language: string;
  theme: 'vs-dark' | 'vs-light';
  onChange: (value: string) => void;
  onSave: () => void;
  className?: string;
}

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

const EDITOR_OPTIONS = {
  selectOnLineNumbers: true,
  roundedSelection: false,
  readOnly: false,
  cursorStyle: 'line' as const,
  automaticLayout: true,
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
    bracketPairs: true,
    indentation: true
  }
};

export function MonacoEditor({
  value,
  language,
  theme,
  onChange,
  onSave,
  className = ''
}: MonacoEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;

    // Configure Ctrl+S shortcut for manual save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });

    // Enhanced layout responsiveness
    const handleResize = () => {
      // Force layout recalculation with a small delay to ensure container has resized
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.layout();
        }
      }, 50);
    };

    // Listen for window resize events (including those triggered by panel resizing)
    window.addEventListener('resize', handleResize);
    
    // Cleanup on unmount
    const cleanup = () => {
      window.removeEventListener('resize', handleResize);
    };
    
    // Store cleanup function for later use
    editor._cleanupResize = cleanup;

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
        provideCompletionItems: () => {
          return {
            suggestions: [
              {
                label: 'def',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: 'def ${1:function_name}(${2:args}):\n\t${3:pass}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Define a function'
              },
              {
                label: 'class',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: 'class ${1:ClassName}:\n\t${2:pass}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Define a class'
              },
              {
                label: 'if __name__ == "__main__"',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: 'if __name__ == "__main__":\n\t${1:main()}',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Main guard'
              }
            ]
          };
        }
      });
    }

    // Focus the editor
    editor.focus();
  };

  // Cleanup effect for Monaco Editor
  const handleEditorWillUnmount = (editor: any) => {
    // Clean up resize listener if it exists
    if (editor._cleanupResize) {
      editor._cleanupResize();
    }
  };

  const handleEditorChange = (newValue: string | undefined) => {
    onChange(newValue || '');
  };

  // Get Monaco-compatible language
  const monacoLanguage = SUPPORTED_LANGUAGES[language as keyof typeof SUPPORTED_LANGUAGES] || 'plaintext';

  return (
    <div className={`h-full w-full ${className}`}>
      <Editor
        height="100%"
        language={monacoLanguage}
        value={value}
        theme={theme}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        onUnmount={handleEditorWillUnmount}
        options={EDITOR_OPTIONS}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        }
      />
    </div>
  );
}