import { useState } from 'react';
import { Upload, Search, FileText, Globe, MessageSquare, Database, Loader2, X, Sparkles, Zap, Code, ArrowRight } from 'lucide-react';
import { ragApiService } from '../services/ragApiService';

// Tooltip component
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <div 
      className="relative inline-block w-full"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && content && (
        <div className="absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg bottom-full left-0 mb-2 w-max max-w-sm break-words">
          {content}
          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

export function SwaggerAPI() {
  // State for RAG generation
  const [ragEndpoint, setRagEndpoint] = useState('');
  const [ragTestCount, setRagTestCount] = useState(2);
  const [ragTestType, setRagTestType] = useState('both');

  // State for document generation
  const [docEndpoint, setDocEndpoint] = useState('');
  const [docTestCount, setDocTestCount] = useState(2);
  const [docTestType, setDocTestType] = useState('both');
  const [documentContent, setDocumentContent] = useState('');
  const [selectedTestFile, setSelectedTestFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');

  // State for RAG management
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState('hybrid');
  const [searchLimit, setSearchLimit] = useState(5);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Loading states
  const [loadingRAG, setLoadingRAG] = useState(false);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingIngest, setLoadingIngest] = useState(false);

  // Results
  const [results, setResults] = useState<any>(null);

  // Event Handlers
  const handleGenerateTests = async () => {
    if (!ragEndpoint) return;
    setLoadingRAG(true);
    try {
      const result = await ragApiService.generateTests(ragEndpoint, ragTestCount, ragTestType);
      setResults(result);
    } catch (error) {
      console.error('Error:', error);
      setResults({ error: 'Failed to generate tests' });
    }
    setLoadingRAG(false);
  };

  const handleGenerateFromDocument = async () => {
    if (!documentContent) return;
    setLoadingDocument(true);
    try {
      const result = await ragApiService.generateTestsFromDocument(documentContent, docEndpoint, docTestCount, docTestType);
      setResults(result);
    } catch (error) {
      console.error('Error:', error);
      setResults({ error: 'Document test generation failed' });
    }
    setLoadingDocument(false);
  };

  const handleGenerateFromFile = async () => {
    if (!selectedTestFile) return;
    setLoadingFile(true);
    try {
      const result = await ragApiService.generateTestsFromFile(selectedTestFile, docEndpoint, docTestCount, docTestType);
      setResults(result);
    } catch (error) {
      console.error('Error:', error);
      setResults({ error: 'File test generation failed' });
    }
    setLoadingFile(false);
  };

  const handleGenerateFromUrl = async () => {
    if (!url) return;
    setLoadingUrl(true);
    try {
      const result = await ragApiService.generateTestsFromUrl(url, docEndpoint, docTestCount, docTestType);
      setResults(result);
    } catch (error) {
      console.error('Error:', error);
      setResults({ error: 'URL test generation failed' });
    }
    setLoadingUrl(false);
  };

  const handleSearchRAG = async () => {
    if (!query) return;
    setLoadingSearch(true);
    try {
      const result = await ragApiService.searchRAG(query, searchMode, searchLimit);
      setResults(result);
    } catch (error) {
      console.error('Error:', error);
      setResults({ error: 'Search failed' });
    }
    setLoadingSearch(false);
  };

  const handleIngestDocument = async () => {
    if (!selectedFile) return;
    setLoadingIngest(true);
    try {
      const result = await ragApiService.ingestDocument(selectedFile);
      setResults(result);
      setSelectedFile(null);
    } catch (error) {
      console.error('Error:', error);
      setResults({ error: 'Document ingestion failed' });
    }
    setLoadingIngest(false);
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-2xl shadow-2xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Database className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Swagger API Test Generator</h1>
              <p className="text-blue-100 text-lg">Generate comprehensive API test cases using AI-powered analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Fast Generation</span>
            </div>
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              <span>Multiple Formats</span>
            </div>
          </div>
        </div>
      </div>

      {/* Generate Tests from RAG */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 hover:shadow-2xl transition-all duration-300">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Generate Tests from RAG</h3>
            <p className="text-slate-600 mt-1">Use your knowledge base to generate contextual test cases</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 mb-3">API Endpoint</label>
            <div className="relative">
              <input
                type="text"
                value={ragEndpoint}
                onChange={(e) => setRagEndpoint(e.target.value)}
                placeholder="GET /users"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-slate-50 hover:bg-white"
              />
              <Code className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Test Count</label>
            <select
              value={ragTestCount}
              onChange={(e) => setRagTestCount(Number(e.target.value))}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-slate-50 hover:bg-white"
            >
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <option key={n} value={n}>{n} test{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Test Type</label>
            <select
              value={ragTestType}
              onChange={(e) => setRagTestType(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-slate-50 hover:bg-white"
            >
              <option value="both">Both Positive & Negative</option>
              <option value="positive">Positive Only</option>
              <option value="negative">Negative Only</option>
            </select>
          </div>
        </div>
        
        <button
          onClick={handleGenerateTests}
          disabled={!ragEndpoint || loadingRAG}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          {loadingRAG ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
          Generate from RAG Knowledge Base
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Generate Tests from Document */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 hover:shadow-2xl transition-all duration-300">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Generate Tests from Document</h3>
            <p className="text-slate-600 mt-1">Upload files, paste content, or provide URLs to generate tests</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 mb-3">API Endpoint <span className="text-slate-400">(Optional)</span></label>
            <div className="relative">
              <input
                type="text"
                value={docEndpoint}
                onChange={(e) => setDocEndpoint(e.target.value)}
                placeholder="GET /users"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200 bg-slate-50 hover:bg-white"
              />
              <Code className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Test Count</label>
            <select
              value={docTestCount}
              onChange={(e) => setDocTestCount(Number(e.target.value))}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200 bg-slate-50 hover:bg-white"
            >
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <option key={n} value={n}>{n} test{n > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Test Type</label>
            <select
              value={docTestType}
              onChange={(e) => setDocTestType(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200 bg-slate-50 hover:bg-white"
            >
              <option value="both">Both Positive & Negative</option>
              <option value="positive">Positive Only</option>
              <option value="negative">Negative Only</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Content Input */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Document Content</label>
            <div className="relative">
              <textarea
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                placeholder="Paste your API specification, Swagger/OpenAPI documentation, or any API-related content here..."
                rows={8}
                className="w-full px-4 py-4 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200 bg-slate-50 hover:bg-white resize-none"
              />
              <FileText className="absolute right-4 top-4 w-5 h-5 text-slate-400" />
            </div>
          </div>

          {/* File Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Upload File</label>
            <div className="relative">
              <input
                type="file"
                onChange={(e) => setSelectedTestFile(e.target.files?.[0] || null)}
                accept=".yaml,.yml,.json,.pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.md"
                className="w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200 bg-slate-50 hover:bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">Supports: YAML, JSON, PDF, Excel, Word, Text, Markdown</p>
          </div>

          {/* URL Input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Swagger URL</label>
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://petstore3.swagger.io/"
                className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200 bg-slate-50 hover:bg-white"
              />
              <Globe className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
            </div>
          </div>

          {/* Prompt Option */}
         
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleGenerateFromDocument}
            disabled={!documentContent || loadingDocument}
            className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-700 text-white rounded-xl hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            {loadingDocument ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
            Generate from Content
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleGenerateFromFile}
            disabled={!selectedTestFile || loadingFile}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-violet-700 text-white rounded-xl hover:from-purple-700 hover:to-violet-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            {loadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            Generate from File
            <ArrowRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleGenerateFromUrl}
            disabled={!url || loadingUrl}
            className="px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
          >
            {loadingUrl ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
            Generate from URL
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* RAG Management */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 hover:shadow-2xl transition-all duration-300">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg">
            <Search className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Knowledge Base Management</h3>
            <p className="text-slate-600 mt-1">Manage documents and search your RAG knowledge base</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Document Ingestion */}
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100">
            <h4 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-purple-600" />
              Add to Knowledge Base
            </h4>
            <p className="text-slate-600 mb-4">Upload documents to expand your RAG knowledge base</p>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              accept=".yaml,.yml,.json,.pdf,.xlsx,.xls,.csv,.docx,.doc,.txt,.md"
              className="w-full px-4 py-3 border-2 border-dashed border-purple-300 rounded-xl focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200 bg-white hover:bg-purple-50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 mb-4"
            />
            <button
              onClick={handleIngestDocument}
              disabled={!selectedFile || loadingIngest}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-700 text-white rounded-xl hover:from-purple-700 hover:to-violet-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {loadingIngest ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              Ingest Document
            </button>
          </div>

          {/* Search RAG */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <h4 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              Search Knowledge Base
            </h4>
            <p className="text-slate-600 mb-4">Find relevant information from your documents</p>
            <div className="relative mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you looking for?"
                className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-blue-50 pr-12"
              />
              <Search className="absolute right-4 top-3 w-5 h-5 text-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <select
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value)}
                className="px-3 py-2 border-2 border-blue-200 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-blue-50"
              >
                <option value="hybrid">Hybrid Search</option>
                <option value="vector">Vector Search</option>
                <option value="keyword">Keyword Search</option>
              </select>
              <select
                value={searchLimit}
                onChange={(e) => setSearchLimit(Number(e.target.value))}
                className="px-3 py-2 border-2 border-blue-200 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white hover:bg-blue-50"
              >
                {[1,2,3,4,5,10,15,20].map(n => (
                  <option key={n} value={n}>{n} result{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSearchRAG}
              disabled={!query || loadingSearch}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {loadingSearch ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              Search Knowledge Base
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 rounded-3xl shadow-2xl p-8 border-2 border-gradient-to-r from-blue-200 to-purple-200 animate-in slide-in-from-bottom-4 duration-700 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
                <div className="relative p-4 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 rounded-2xl shadow-xl">
                  <Sparkles className="w-7 h-7 text-white animate-bounce" />
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-blue-800 to-purple-800 bg-clip-text text-transparent">Generated Results</h3>
                <p className="text-slate-600 mt-1 font-medium">AI-powered test case generation complete</p>
              </div>
            </div>
            <button
              onClick={() => setResults(null)}
              className="p-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all duration-300 hover:scale-110 hover:rotate-90"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Test Cases Display */}
          {(results.result?.newTestCases || results.newTestCases || results.testCases) && Array.isArray(results.result?.newTestCases || results.newTestCases || results.testCases) ? (
            <div className="mb-8">
              <div className="overflow-x-auto bg-white rounded-lg shadow-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preconditions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test Steps</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Results</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(results.result?.newTestCases || results.newTestCases || results.testCases || []).map((testCase: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                          {testCase.testCaseId || testCase.id || `TC_${String(index + 1).padStart(3, '0')}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {testCase.module || 'General'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          <Tooltip content={testCase.testCaseTitle || testCase.title || testCase.name || `Test Case ${index + 1}`}>
                            <div className="truncate cursor-help">
                              {testCase.testCaseTitle || testCase.title || testCase.name || `Test Case ${index + 1}`}
                            </div>
                          </Tooltip>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
                          <Tooltip content={testCase.testCaseDescription || testCase.description || 'No description available'}>
                            <div className="line-clamp-3 cursor-help">
                              {testCase.testCaseDescription || testCase.description || 'No description available'}
                            </div>
                          </Tooltip>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-sm">
                          <Tooltip content={testCase.preconditions || 'No preconditions specified'}>
                            <div className="line-clamp-2 cursor-help">
                              {testCase.preconditions || 'No preconditions specified'}
                            </div>
                          </Tooltip>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
                          <Tooltip content={testCase.testSteps || testCase.steps || 'No test steps provided'}>
                            <div className="whitespace-pre-line line-clamp-3 cursor-help">
                              {testCase.testSteps || testCase.steps || 'No test steps provided'}
                            </div>
                          </Tooltip>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-sm">
                          <Tooltip content={testCase.expectedResults || testCase.expected || 'No expected results specified'}>
                            <div className="line-clamp-2 cursor-help">
                              {testCase.expectedResults || testCase.expected || 'No expected results specified'}
                            </div>
                          </Tooltip>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            testCase.priority === 'P1' ? 'bg-red-100 text-red-800' :
                            testCase.priority === 'P2' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {testCase.priority || 'P2'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {testCase.testType || 'Functional'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            testCase.riskLevel === 'Critical' ? 'bg-red-100 text-red-800' :
                            testCase.riskLevel === 'High' ? 'bg-orange-100 text-orange-800' :
                            testCase.riskLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {testCase.riskLevel || 'Medium'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {testCase.estimatedExecutionTime || '5 minutes'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Raw JSON Display */
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl blur-xl"></div>
              <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 max-h-96 overflow-auto border border-slate-700 shadow-2xl">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                  <span className="text-slate-400 text-sm font-mono ml-4">test-results.json</span>
                </div>
                <pre className="text-sm text-green-400 whitespace-pre-wrap font-mono leading-relaxed selection:bg-green-400/20">
                  <code className="language-json">
                    {JSON.stringify(results, null, 2)}
                  </code>
                </pre>
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-4 mb-8">
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(results, null, 2))}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 transition-all duration-300 flex items-center gap-3 text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Code className="w-5 h-5" />
              Copy to Clipboard
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'test-results.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl hover:from-emerald-700 hover:to-teal-800 transition-all duration-300 flex items-center gap-3 text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <FileText className="w-5 h-5" />
              Download JSON
            </button>
            <button
              onClick={() => {
                const testCases = results.newTestCases || [results];
                const csvContent = testCases.map((test: any) => 
                  `"${test.testCaseId || 'N/A'}","${test.testCaseTitle || test.name || 'Test'}","${test.module || 'General'}","${test.priority || 'P2'}","${test.riskLevel || 'Medium'}","${test.testType || 'Functional'}","${test.estimatedExecutionTime || '5 minutes'}"`
                ).join('\n');
                const blob = new Blob([`ID,Title,Module,Priority,Risk Level,Type,Execution Time\n${csvContent}`], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'test-cases.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-300 flex items-center gap-3 text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Database className="w-5 h-5" />
              Export CSV
            </button>
          </div>
          
          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-700">Test Cases</p>
                  <p className="text-lg font-bold text-blue-900">
                    {results.result?.newTestCases?.length || results.newTestCases?.length || (Array.isArray(results.testCases) ? results.testCases.length : '1')}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-4 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700">Status</p>
                  <p className="text-lg font-bold text-green-900">Generated</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <Code className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-700">Format</p>
                  <p className="text-lg font-bold text-purple-900">Structured</p>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-red-100 rounded-xl p-4 border border-orange-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500 rounded-lg">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-orange-700">Coverage</p>
                  <p className="text-lg font-bold text-orange-900">
                    {results.result?.newTestCases ? 
                      `${results.result.newTestCases.filter((tc: any) => tc.priority === 'P1').length} Critical` : 
                      results.newTestCases ? 
                        `${results.newTestCases.filter((tc: any) => tc.priority === 'P1').length} Critical` :
                        'Complete'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}