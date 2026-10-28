import React, { useEffect, useRef } from 'react';
import katex from 'katex';

interface MathRendererProps {
  text: string;
  className?: string;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ text, className = '' }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check if contains LaTeX syntax e.g. $...$ or \(...\)
    const latexRegex = /\$([^\$]+)\$/g;
    if (latexRegex.test(text)) {
      const parts = text.split(/(\$[^\$]+\$)/g);
      containerRef.current.innerHTML = '';

      parts.forEach((part) => {
        if (part.startsWith('$') && part.endsWith('$')) {
          const formula = part.slice(1, -1);
          const mathSpan = document.createElement('span');
          try {
            katex.render(formula, mathSpan, {
              throwOnError: false,
              displayMode: false
            });
            containerRef.current?.appendChild(mathSpan);
          } catch {
            const fallback = document.createTextNode(part);
            containerRef.current?.appendChild(fallback);
          }
        } else {
          const textNode = document.createTextNode(part);
          containerRef.current?.appendChild(textNode);
        }
      });
    } else {
      containerRef.current.textContent = text;
    }
  }, [text]);

  return <span ref={containerRef} className={className} />;
};
