import { useRef, useEffect, useState, useCallback } from 'react';
import type Quill from 'quill';
import { FallbackTextEditor } from './FallbackTextEditor';

export interface QuillEditorProps {
  value: string;
  theme: 'light' | 'dark';
  onChange: (value: string) => void;
  onSave: () => void;
  placeholder?: string;
  className?: string;
}

// Comprehensive toolbar configuration for coding-friendly rich text editing
const TOOLBAR_OPTIONS = [
  [{ 'header': [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
  ['blockquote', 'code-block'],
  ['link', 'image'],
  [{ 'align': [] }],
  [{ 'color': [] }, { 'background': [] }],
  [{ 'script': 'sub'}, { 'script': 'super' }],
  [{ 'indent': '-1'}, { 'indent': '+1' }],
  ['clean']
];

const QUILL_MODULES = {
  toolbar: TOOLBAR_OPTIONS,
  keyboard: {
    bindings: {
      // Custom keyboard shortcuts will be added in the component
    }
  },
  history: {
    delay: 1000,
    maxStack: 50
  }
};

const QUILL_FORMATS = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'list', 'bullet', 'check', 'indent',
  'link', 'image', 'video', 'formula',
  'align', 'direction', 'color', 'background',
  'script', 'code', 'code-block'
];

export function QuillEditor({
  value,
  theme,
  onChange,
  onSave,
  placeholder = 'Write your notes here...',
  className = ''
}: QuillEditorProps) {
  const quillRef = useRef<HTMLDivElement>(null);
  const quillInstance = useRef<Quill | null>(null);
  const isUpdatingRef = useRef(false);
  const initializationLock = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Complete cleanup function
  const cleanupQuill = useCallback(() => {
    if (quillInstance.current) {
      try {
        // Remove all event listeners
        quillInstance.current.off('text-change');
        quillInstance.current = null;
      } catch (err) {
        console.warn('Error during Quill cleanup:', err);
      }
    }
    
    // Clear the container content to prevent leftover toolbars
    if (quillRef.current) {
      quillRef.current.innerHTML = '';
    }
    
    setIsReady(false);
    initializationLock.current = false;
  }, []);

  // Initialize Quill instance with safeguards against double initialization
  const initializeQuill = useCallback(async () => {
    // Prevent double initialization
    if (quillInstance.current || initializationLock.current || !quillRef.current) {
      return;
    }

    try {
      initializationLock.current = true;
      setIsInitializing(true);
      setError(null);

      // Clean up any existing content first
      if (quillRef.current) {
        quillRef.current.innerHTML = '';
      }

      // Dynamic import of Quill
      const { default: Quill } = await import('quill');
      
      // Double-check container still exists after async operation
      if (!quillRef.current) {
        throw new Error('Quill container element not found after import');
      }

      // Create Quill instance with explicit container
      const quill = new Quill(quillRef.current, {
        theme: 'snow',
        modules: QUILL_MODULES,
        formats: QUILL_FORMATS,
        placeholder
      });

      // Verify only one toolbar was created
      const toolbars = quillRef.current.querySelectorAll('.ql-toolbar');
      if (toolbars.length > 1) {
        console.warn(`Multiple toolbars detected (${toolbars.length}), removing duplicates`);
        // Keep only the first toolbar
        for (let i = 1; i < toolbars.length; i++) {
          toolbars[i].remove();
        }
      }

      quillInstance.current = quill;

      // Set initial content
      if (value) {
        isUpdatingRef.current = true;
        if (value.startsWith('<') || value.includes('<p>')) {
          // HTML content
          quill.root.innerHTML = value;
        } else {
          // Plain text content
          quill.setText(value);
        }
        isUpdatingRef.current = false;
      }

      // Add text change listener
      quill.on('text-change', () => {
        if (isUpdatingRef.current) return;
        
        const html = quill.root.innerHTML;
        const isEmpty = html === '<p><br></p>' || html === '<p></p>' || !html.trim();
        onChange(isEmpty ? '' : html);
      });

      // Add keyboard shortcuts
      quill.keyboard.addBinding({
        key: 'S',
        ctrlKey: true
      }, () => {
        onSave();
        return false; // Prevent default browser save
      });

      quill.keyboard.addBinding({
        key: 'S',
        metaKey: true
      }, () => {
        onSave();
        return false;
      });

      setIsReady(true);
      
    } catch (err) {
      console.error('Failed to initialize Quill editor:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize rich text editor';
      setError(errorMessage);
      cleanupQuill(); // Clean up on error
    } finally {
      setIsInitializing(false);
      initializationLock.current = false;
    }
  }, [value, onChange, onSave, placeholder, cleanupQuill]);

  // Update content when value changes externally
  useEffect(() => {
    if (!quillInstance.current || !isReady || isUpdatingRef.current) return;

    const quill = quillInstance.current;
    const currentContent = quill.root.innerHTML;
    
    // Only update if content actually differs
    if (value !== currentContent) {
      isUpdatingRef.current = true;
      
      if (!value || value.trim() === '') {
        quill.setText('');
      } else if (value.startsWith('<') || value.includes('<p>')) {
        quill.root.innerHTML = value;
      } else {
        quill.setText(value);
      }
      
      isUpdatingRef.current = false;
    }
  }, [value, isReady]);

  // Initialize Quill on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeQuill();
    }, 100); // Small delay to ensure DOM is ready
    
    return () => {
      clearTimeout(timer);
      cleanupQuill();
    };
  }, []); // Empty dependency array - only run on mount/unmount

  // Show error state with fallback option
  if (error) {
    return (
      <div className={`h-full w-full ${className}`}>
        <div className="h-full w-full flex flex-col items-center justify-center p-4">
          <div className="text-center mb-4">
            <div className="text-red-500 dark:text-red-400 mb-2">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Rich Text Editor Error
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <div className="flex space-x-2 justify-center">
              <button
                onClick={() => {
                  setError(null);
                  cleanupQuill();
                  setTimeout(initializeQuill, 100);
                }}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
          
          {/* Fallback editor */}
          <div className="w-full h-full border-t pt-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 text-center">
              Using plain text editor as fallback:
            </p>
            <FallbackTextEditor
              value={value}
              theme={theme}
              onChange={onChange}
              onSave={onSave}
              placeholder={placeholder}
              className="h-full"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full relative ${className}`}>
      {/* Quill container */}
      <div 
        ref={quillRef}
        className={`quill-editor-container ${theme === 'dark' ? 'quill-dark' : 'quill-light'}`}
        style={{ 
          display: isReady ? 'block' : 'none',
          height: '100%'
        }}
      />
      
      {/* Loading overlay */}
      {(!isReady && !error) && (
        <div className="absolute inset-0 bg-white dark:bg-gray-800 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isInitializing ? 'Loading rich text editor...' : 'Preparing editor...'}
            </p>
          </div>
        </div>
      )}

      {/* All Quill styles scoped to this component */}
      <style>{`
        /* Base container - no background, inherit from workspace */
        .quill-editor-container {
          height: 100%;
          width: 100%;
        }
        
        /* Base Quill Styles - Light Theme */
        .quill-light .ql-toolbar {
          border: 1px solid #e5e7eb;
          border-bottom: none;
          background-color: #f9fafb;
          padding: 8px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        
        .quill-light .ql-container {
          border: 1px solid #e5e7eb;
          border-top: none;
          background-color: white;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          height: calc(100% - 42px);
        }
        
        .quill-light .ql-editor {
          padding: 16px;
          line-height: 1.6;
          font-size: 14px;
          color: #374151;
          min-height: 150px;
          background-color: white;
        }
        
        .quill-light .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: italic;
        }
        
        /* Dark Theme Styles - seamless integration */
        .quill-dark .ql-toolbar {
          background-color: #374151;
          border: 1px solid #4b5563;
          border-bottom: none;
          color: #f9fafb;
          padding: 8px;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        
        .quill-dark .ql-container {
          background-color: #1f2937;
          border: 1px solid #4b5563;
          border-top: none;
          color: #f9fafb;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          height: calc(100% - 42px);
        }
        
        .quill-dark .ql-editor {
          color: #f9fafb;
          background-color: #1f2937;
          padding: 16px;
          line-height: 1.6;
          font-size: 14px;
          min-height: 150px;
        }
        
        .quill-dark .ql-editor.ql-blank::before {
          color: #9ca3af;
          font-style: italic;
        }
        
        /* Dark theme toolbar icons and buttons */
        .quill-dark .ql-toolbar .ql-stroke {
          stroke: #f9fafb;
        }
        
        .quill-dark .ql-toolbar .ql-fill {
          fill: #f9fafb;
        }
        
        .quill-dark .ql-toolbar button:hover,
        .quill-dark .ql-toolbar button.ql-active {
          background-color: #4b5563;
        }
        
        .quill-dark .ql-toolbar .ql-picker-options {
          background-color: #374151;
          border-color: #4b5563;
        }
        
        .quill-dark .ql-toolbar .ql-picker-item {
          color: #f9fafb;
        }
        
        .quill-dark .ql-toolbar .ql-picker-item:hover {
          background-color: #4b5563;
        }
        
        .quill-dark .ql-toolbar .ql-picker-label {
          color: #f9fafb;
        }
        
        /* Dark theme content styling */
        .quill-dark .ql-editor h1,
        .quill-dark .ql-editor h2,
        .quill-dark .ql-editor h3 {
          color: #f9fafb;
        }
        
        .quill-dark .ql-editor blockquote {
          border-left-color: #4b5563;
          color: #d1d5db;
        }
        
        .quill-dark .ql-editor code,
        .quill-dark .ql-editor pre {
          background-color: #374151;
          color: #f9fafb;
        }
        
        /* Ensure no duplicate toolbars */
        .quill-editor-container .ql-container .ql-toolbar {
          display: none !important;
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .quill-editor-container .ql-toolbar {
            padding: 6px;
          }
          
          .quill-editor-container .ql-formats {
            margin-right: 6px;
          }
        }
      `}</style>
    </div>
  );
}