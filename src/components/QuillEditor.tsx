import { useRef, useEffect, useState, useCallback } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';

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
  'list', 'bullet',
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
  const quillRef = useRef<HTMLDivElement>(null);
  const quillInstance = useRef<Quill | null>(null);
  const [isReady, setIsReady] = useState(false);
  const isUpdating = useRef(false);

  // Initialize Quill instance
  useEffect(() => {
    if (!quillRef.current || quillInstance.current) return;

    const quill = new Quill(quillRef.current, {
      theme: 'snow',
      modules: QUILL_MODULES,
      formats: QUILL_FORMATS,
      placeholder
    });

    quillInstance.current = quill;

    // Add Ctrl+S shortcut
    quill.keyboard.addBinding({
      key: 'S',
      ctrlKey: true,
      metaKey: true
    }, () => {
      onSave();
      return false; // Prevent default browser save
    });

    // Handle text changes
    quill.on('text-change', (delta, oldDelta, source) => {
      if (source === 'user' && !isUpdating.current) {
        const html = quill.root.innerHTML;
        onChange(html === '<p><br></p>' ? '' : html);
      }
    });

    setIsReady(true);

    return () => {
      if (quillInstance.current) {
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

  if (!isReady) {
    return (
      <div className={`h-full w-full flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full ${className}`}>
      <style jsx>{`
        :global(.ql-toolbar.dark-theme) {
          background-color: #374151;
          border-color: #4B5563;
          color: #F3F4F6;
        }
        
        :global(.ql-toolbar.dark-theme .ql-stroke) {
          stroke: #F3F4F6;
        }
        
        :global(.ql-toolbar.dark-theme .ql-fill) {
          fill: #F3F4F6;
        }
        
        :global(.ql-toolbar.dark-theme button:hover) {
          background-color: #4B5563;
        }
        
        :global(.ql-toolbar.dark-theme button.ql-active) {
          background-color: #3B82F6;
          color: white;
        }
        
        :global(.ql-toolbar.dark-theme .ql-picker-label) {
          color: #F3F4F6;
        }
        
        :global(.ql-toolbar.dark-theme .ql-picker-options) {
          background-color: #374151;
          border-color: #4B5563;
        }
        
        :global(.ql-container.dark-theme) {
          background-color: #1F2937;
          border-color: #4B5563;
          color: #F3F4F6;
        }
        
        :global(.ql-editor.dark-theme) {
          color: #F3F4F6;
        }
        
        :global(.ql-editor.dark-theme h1, .ql-editor.dark-theme h2, .ql-editor.dark-theme h3) {
          color: #F3F4F6;
        }
        
        :global(.ql-editor.dark-theme blockquote) {
          border-left-color: #6B7280;
          color: #D1D5DB;
        }
        
        :global(.ql-editor.dark-theme code, .ql-editor.dark-theme pre) {
          background-color: #374151;
          color: #F3F4F6;
        }
        
        :global(.ql-editor.dark-theme a) {
          color: #60A5FA;
        }
      `}</style>
      
      <div 
        ref={quillRef} 
        className="h-full"
        style={{ 
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
      />
    </div>
  );
}