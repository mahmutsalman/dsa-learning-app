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

const TOOLBAR_OPTIONS = [
  [{ 'header': [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  ['blockquote', 'code-block'],
  ['link'],
  [{ 'align': [] }],
  [{ 'color': [] }, { 'background': [] }],
  ['clean']
];

const QUILL_MODULES = {
  toolbar: TOOLBAR_OPTIONS,
  keyboard: {
    bindings: {
      // We'll add custom bindings in the component
    }
  }
};

const QUILL_FORMATS = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'list',
  'blockquote', 'code-block',
  'link',
  'align',
  'color', 'background'
];

export function QuillEditor({
  value,
  theme,
  onChange,
  onSave,
  placeholder = 'Write your notes here...',
  className = ''
}: QuillEditorProps) {
  console.log('📝 QuillEditor component rendering with props:', {
    valueLength: value?.length || 0,
    theme,
    placeholder,
    hasOnChange: !!onChange,
    hasOnSave: !!onSave
  });
  const quillRef = useRef<HTMLDivElement>(null);
  const quillInstance = useRef<Quill | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  
  console.log('🔍 Current state:', { isReady, error, isInitializing, useFallback });
  const isUpdating = useRef(false);

  // Initialize Quill instance with proper DOM readiness check
  useEffect(() => {
    console.log('🔧 QuillEditor useEffect triggered');
    console.log('🔧 quillRef.current:', !!quillRef.current);
    console.log('🔧 quillInstance.current:', !!quillInstance.current);
    console.log('🔧 isInitializing:', isInitializing);
    
    if (quillInstance.current || isInitializing) {
      console.log('🔧 Early return - already initializing or initialized');
      return;
    }
    
    // Wait for DOM element to be available with retry mechanism
    const checkAndInitialize = () => {
      console.log('🔍 Checking DOM element availability...');
      if (!quillRef.current) {
        console.log('🔧 DOM element not ready yet, will retry...');
        return false;
      }
      console.log('✅ DOM element is ready, proceeding with initialization');
      return true;
    };

    const initializeQuill = async () => {
      try {
        console.log('🚀 Starting Quill initialization process...');
        setIsInitializing(true);
        setError(null);
        
        // Verify DOM element is ready
        if (!quillRef.current) {
          throw new Error('Quill container element not found after initialization start');
        }
        console.log('✅ DOM element verified:', quillRef.current);
        
        // Check if element is in DOM
        if (!document.contains(quillRef.current)) {
          throw new Error('Quill container element is not in DOM');
        }
        console.log('✅ Element is in DOM');
        
        // Try multiple import strategies
        console.log('📦 Attempting to import Quill module...');
        let QuillClass;
        
        try {
          // Strategy 1: Default dynamic import
          console.log('📦 Strategy 1: Dynamic import...');
          const quillModule = await import('quill');
          console.log('📦 Import result:', quillModule);
          QuillClass = quillModule.default || quillModule;
          console.log('📦 QuillClass:', QuillClass);
        } catch (importError) {
          console.error('❌ Dynamic import failed:', importError);
          
          // Strategy 2: Try named import
          try {
            console.log('📦 Strategy 2: Named import...');
            const { Quill } = await import('quill');
            QuillClass = Quill;
            console.log('📦 Named import successful:', QuillClass);
          } catch (namedImportError) {
            console.error('❌ Named import failed:', namedImportError);
            throw new Error(`Failed to import Quill: ${importError.message}`);
          }
        }
        
        if (!QuillClass) {
          throw new Error('Quill class is undefined after import');
        }
        console.log('✅ Quill module imported successfully');
        
        // Verify the element is still valid
        if (!quillRef.current) {
          throw new Error('Quill container element lost during import');
        }
        
        console.log('🏗️ Creating Quill instance with config:', {
          theme: 'snow',
          modules: QUILL_MODULES,
          formats: QUILL_FORMATS,
          placeholder
        });
        
        const quill = new QuillClass(quillRef.current, {
          theme: 'snow',
          modules: QUILL_MODULES,
          formats: QUILL_FORMATS,
          placeholder
        });
        
        console.log('✅ Quill instance created successfully:', quill);
        console.log('🎨 Quill root element:', quill.root);
        console.log('🔧 Quill toolbar element:', quill.getModule('toolbar')?.container);
        
        // Verify toolbar is present
        const toolbar = quillRef.current.querySelector('.ql-toolbar');
        console.log('🔍 Toolbar element found:', !!toolbar);
        if (toolbar) {
          console.log('🎯 Toolbar HTML:', toolbar.outerHTML.substring(0, 200) + '...');
        }

        quillInstance.current = quill;
        console.log('✅ Quill instance stored in ref');

        // Add Ctrl+S shortcut
        console.log('⌨️ Adding keyboard shortcuts...');
        quill.keyboard.addBinding({
          key: 'S',
          ctrlKey: true,
          metaKey: true
        }, () => {
          console.log('⌨️ Ctrl+S pressed in editor');
          onSave();
          return false; // Prevent default browser save
        });
        console.log('✅ Keyboard shortcuts added');

        // Handle text changes
        console.log('📝 Adding text change listener...');
        quill.on('text-change', (delta, oldDelta, source) => {
          console.log('📝 Text changed:', { source, delta });
          if (source === 'user' && !isUpdating.current) {
            const html = quill.root.innerHTML;
            console.log('📝 Calling onChange with:', html === '<p><br></p>' ? 'empty' : 'content');
            onChange(html === '<p><br></p>' ? '' : html);
          }
        });
        console.log('✅ Text change listener added');

        console.log('🎉 Quill editor initialized successfully!');
        console.log('✅ Setting isReady to true');
        setIsReady(true);
        
      } catch (err) {
        console.error('❌ FAILED to initialize Quill editor:', err);
        console.error('❌ Error stack:', err instanceof Error ? err.stack : 'No stack trace');
        console.error('❌ Error type:', typeof err);
        console.error('❌ Error constructor:', err?.constructor?.name);
        
        const errorMessage = err instanceof Error ? err.message : 'Unknown error during editor initialization';
        console.log('❌ Setting error state:', errorMessage);
        setError(errorMessage);
        
        // Auto-fallback after 3 seconds of showing error
        console.log('⏰ Setting auto-fallback timer...');
        setTimeout(() => {
          console.log('⏰ Auto-fallback triggered');
          setUseFallback(true);
        }, 3000);
      } finally {
        console.log('🏁 Quill initialization process finished');
        setIsInitializing(false);
      }
    };

    // Retry mechanism to wait for DOM element
    let retryCount = 0;
    const maxRetries = 20; // Max 2 seconds (20 * 100ms)
    
    const attemptInitialization = () => {
      console.log(`🔄 Initialization attempt ${retryCount + 1}/${maxRetries}`);
      
      if (checkAndInitialize()) {
        initializeQuill();
        return;
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`⏱️ Retrying in 100ms... (${retryCount}/${maxRetries})`);
        setTimeout(attemptInitialization, 100);
      } else {
        console.error('❌ Max retries reached - DOM element never became available');
        setError('Editor failed to initialize: DOM element not available');
      }
    };
    
    console.log('🚀 Starting initialization attempt...');
    attemptInitialization();
    
    return () => {
      console.log('🧹 QuillEditor cleanup function called');
      if (quillInstance.current) {
        console.log('🧹 Cleaning up Quill instance');
        quillInstance.current = null;
      }
    };
  }, [onChange, onSave, placeholder]);

  // Update content when value changes externally
  useEffect(() => {
    if (!quillInstance.current || !isReady) return;

    const currentContent = quillInstance.current.root.innerHTML;
    const newContent = value || '';
    
    // Only update if content is actually different
    if (currentContent !== newContent && (newContent !== '<p><br></p>' || currentContent !== '')) {
      isUpdating.current = true;
      
      if (newContent === '') {
        quillInstance.current.setText('');
      } else {
        quillInstance.current.root.innerHTML = newContent;
      }
      
      isUpdating.current = false;
    }
  }, [value, isReady]);

  // Apply dark theme styles
  useEffect(() => {
    if (!quillRef.current) return;

    const editorContainer = quillRef.current.closest('.ql-container');
    const toolbar = quillRef.current.parentElement?.querySelector('.ql-toolbar');

    if (theme === 'dark') {
      // Add dark theme classes
      editorContainer?.classList.add('dark-theme');
      toolbar?.classList.add('dark-theme');
    } else {
      // Remove dark theme classes
      editorContainer?.classList.remove('dark-theme');
      toolbar?.classList.remove('dark-theme');
    }
  }, [theme]);

  // Show error state if initialization failed
  if (error) {
    return (
      <div className={`h-full w-full flex items-center justify-center ${className}`}>
        <div className="text-center p-4">
          <div className="text-red-500 dark:text-red-400 mb-2">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Editor Error
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{error}</p>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setError(null);
                setIsReady(false);
                // Trigger re-initialization
                if (quillInstance.current) {
                  quillInstance.current = null;
                }
              }}
              className="px-3 py-1 text-sm bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => setUseFallback(true)}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Use Plain Text
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Use fallback text editor if requested or if rich text fails
  if (useFallback) {
    return (
      <FallbackTextEditor
        value={value}
        theme={theme}
        onChange={onChange}
        onSave={onSave}
        placeholder={placeholder}
        className={className}
      />
    );
  }

  return (
    <div className={`h-full w-full relative ${className}`}>
      {/* Always render the Quill container div so the ref can attach */}
      <div 
        ref={quillRef} 
        className="h-full"
        style={{ 
          height: '100%',
          display: 'block',
          visibility: isReady ? 'visible' : 'hidden'
        }}
      />
      
      {/* Show loading overlay when not ready */}
      {!isReady && (
        <div className="h-full w-full flex items-center justify-center absolute inset-0 bg-white dark:bg-gray-800">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isInitializing ? 'Loading editor...' : 'Preparing editor...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}