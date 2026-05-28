import React, { useState, useEffect } from 'react';
import { ChevronRight, Loader, Search } from 'lucide-react';

export default function NaelMindViewer() {
  const [files, setFiles] = useState([]);
  const [content, setContent] = useState('');
  const [currentFile, setCurrentFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const API_BASE = 'https://nael-mind.vercel.app/api';

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/files`);
      const data = await res.json();
      setFiles(data.files || []);
      setError('');
      
      if (data.files?.length > 0) {
        loadFile(data.files[0].path);
      }
    } catch (err) {
      setError('Failed to load files: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadFile = async (filePath) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/read?filename=${filePath}`);
      const data = await res.json();
      setContent(data.content);
      setCurrentFile(filePath);
      setError('');
    } catch (err) {
      setError('Failed to load content: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const markdownToHtml = (md) => {
    let html = md
      .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    return html;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-purple-600 to-blue-600">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🧠 Nael Mind</h2>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredFiles.map(file => (
            <button
              key={file.path}
              onClick={() => loadFile(file.path)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                currentFile === file.path
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4" />
                {file.name}
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t bg-gray-50 text-sm text-gray-600">
          {files.length} files total
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-800">
            {currentFile ? currentFile.split('/').pop() : 'Select a file'}
          </h1>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-lg">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          )}

          {!loading && content && (
            <div 
              className="prose prose-sm max-w-none
                prose-h1:text-3xl prose-h1:text-blue-600 prose-h1:border-b-2 prose-h1:pb-4 prose-h1:mb-6
                prose-h2:text-2xl prose-h2:text-blue-500 prose-h2:mt-8 prose-h2:mb-4
                prose-h3:text-xl prose-h3:text-gray-700
                prose-p:text-gray-700 prose-p:leading-relaxed
                prose-strong:text-gray-900 prose-strong:font-bold
                prose-em:text-gray-600
                prose-a:text-blue-600 prose-a:underline
                prose-code:bg-gray-100 prose-code:px-2 prose-code:rounded
                prose-pre:bg-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto
                prose-li:text-gray-700
                prose-ul:list-disc prose-ul:ml-6"
              dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
            />
          )}

          {!loading && !content && !error && (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg">Select a file to view content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}