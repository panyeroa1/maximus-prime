import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';

const highlightSsml = (text: string): string => {
  if (!text) return '';
  let highlightedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Comments first
  highlightedText = highlightedText.replace(/(&lt;!--.*?--&gt;)/g, `<span class="text-gray-500">$1</span>`);
  
  // Attribute values
  highlightedText = highlightedText.replace(/="([^"]*)"/g, `="<span class="text-eburon-ok">"$1"</span>"`);
  
  // Attribute names
  highlightedText = highlightedText.replace(/ ([\w:-]+)=/g, ` <span class="text-eburon-warn">$1</span>=`);
  
  // Tag names, being careful not to re-highlight things in our spans
  highlightedText = highlightedText.replace(/(&lt;\/?)([\w:-]+)/g, `$1<span class="text-eburon-accent-dark font-semibold">$2</span>`);
  
  return highlightedText;
};


export interface SsmlEditorRef {
  insertSnippet: (snippet: string) => void;
}

interface SsmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const SsmlEditor = forwardRef<SsmlEditorRef, SsmlEditorProps>(({ value, onChange, disabled, className, placeholder }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLElement>(null);
  
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
        highlightRef.current.parentElement!.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.parentElement!.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  useImperativeHandle(ref, () => ({
    insertSnippet(snippet) {
      if (!textareaRef.current) return;
      
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = textareaRef.current.value;
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      
      const newText = before + snippet + after;
      onChange(newText);
      
      // Move cursor after inserted text
      setTimeout(() => {
        if(textareaRef.current) {
           textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + snippet.length;
           textareaRef.current.focus();
        }
      }, 0);
    }
  }));
  
  const baseClasses = "w-full flex-grow bg-eburon-panel border border-eburon-border rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-eburon-accent text-lg font-mono resize-none";
  const finalClassName = `${baseClasses} ${className || ''}`;

  return (
    <div className={`relative w-full h-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={handleScroll}
        spellCheck="false"
        className={`${finalClassName} absolute inset-0 bg-transparent caret-white text-transparent`}
        disabled={disabled}
        placeholder={placeholder}
      />
      <pre
        className={`${finalClassName} absolute inset-0 overflow-auto pointer-events-none`}
        aria-hidden="true"
      >
        <code ref={highlightRef} dangerouslySetInnerHTML={{ __html: highlightSsml(value) + '\n' }} />
      </pre>
    </div>
  );
});

export default SsmlEditor;