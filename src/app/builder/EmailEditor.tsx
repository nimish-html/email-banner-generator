"use client";

import { useState, useRef, DragEvent } from 'react';

interface EmailBlock {
  id: string;
  type: 'image' | 'text';
  content: string;
}

export default function EmailEditor() {
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow dropping
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    // Check if the leave event is transitioning outside the editor bounds
    if (editorRef.current && !editorRef.current.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const imageUrl = e.dataTransfer.getData('text/plain');

    if (imageUrl) {
      const newBlock: EmailBlock = {
        id: `block-${Date.now()}`,
        type: 'image',
        content: imageUrl,
      };
      setBlocks([...blocks, newBlock]);
    }
  };

  const generateHtml = () => {
    let html = '<!DOCTYPE html><html><head><style>img { max-width: 100%; height: auto; display: block; margin-bottom: 10px; }</style></head><body>';
    blocks.forEach(block => {
      if (block.type === 'image') {
        html += `<img src="${block.content}" alt="Banner Image">`;
      }
      // Add text block handling later if needed
    });
    html += '</body></html>';
    return html;
  };

  const handleExportHtml = () => {
    const htmlContent = generateHtml();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'email-template.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div
        ref={editorRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`min-h-[300px] border-2 border-dashed rounded-lg p-4 transition-colors duration-200 ${isDraggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
      >
        <p className={`text-center text-gray-500 ${blocks.length > 0 ? 'mb-4' : ''}`}>
          {isDraggingOver ? 'Drop image here!' : 'Drag banners from the gallery above and drop them here.'}
        </p>
        <div className="space-y-2">
          {blocks.map(block => (
            <div key={block.id}>
              {block.type === 'image' ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={block.content} alt="Email Banner" className="max-w-full h-auto rounded shadow" />
                </>
              ) : null}
              {/* Render text blocks here if implemented */}
            </div>
          ))}
        </div>
      </div>
      {blocks.length > 0 && (
          <button
            onClick={handleExportHtml}
            className="w-full mt-4 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Export Email HTML
          </button>
      )}
    </div>
  );
}
