// src/components/shared/JsonHighlighter.jsx
import React from "react";

export default function JsonHighlighter({ code }) {
  const highlightJson = (text) => {
    // Try to parse and pretty-print if valid JSON
    let formattedText = text;
    try {
      const parsed = JSON.parse(text);
      formattedText = JSON.stringify(parsed, null, 2);
    } catch {
      // If not valid JSON, use as-is
    }

    // Escape HTML first
    const escaped = formattedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Apply syntax highlighting with CSS classes
    const highlighted = escaped
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
        if (/:$/.test(match)) {
          // Property key
          return `<span class="json-key">${match}</span>`;
        }
        // String value
        return `<span class="json-string">${match}</span>`;
      })
      .replace(/\b(true|false|null)\b/g, '<span class="json-keyword">$1</span>')
      .replace(/\b(-?\d+\.?\d*)\b/g, '<span class="json-number">$1</span>');

    return highlighted;
  };

  return (
    <pre 
      className="json-highlighter"
      dangerouslySetInnerHTML={{ __html: highlightJson(code) }}
    />
  );
}
