import { useState, useEffect } from 'react';
import { Upload, Eye, Send, FileText, Image, FileCode, CheckCircle, XCircle, Loader2, Edit2, Trash2, Plus, Database, Cloud } from 'lucide-react';
import {
  uploadFile,
  exportToJira,
  exportToServiceNow,
  getIntegrationConfig,
  type Epic,
  type UserStory,
  type ProcessingResult,
  type ExportResult,
  type IntegrationConfig,
} from '../services/epicStoryService';

type Tab = 'upload' | 'review' | 'export';

export function EpicStoryExtraction() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [exportSuccess, setExportSuccess] = useState('');
  const [exportError, setExportError] = useState('');
  
  // Integration config state
  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig | null>(null);
  const [projectKey, setProjectKey] = useState('');

  // Load integration configuration on mount
  useEffect(() => {
    const loadIntegrationConfig = async () => {
      try {
        const config = await getIntegrationConfig();
        setIntegrationConfig(config);
        console.log('Loaded integration config:', config);
      } catch (error) {
        console.error('Failed to load integration config:', error);
      }
    };
    loadIntegrationConfig();
  }, []);

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setSelectedFile(file);

    try {
      const result = await uploadFile(file);
      setProcessingResult(result.data);
      setEpics(result.data.epics);
      setActiveTab('review');
    } catch (error: any) {
      setUploadError(error.response?.data?.error || error.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Edit epic
  const handleEditEpic = (epicId: string, field: 'title' | 'description', value: string) => {
    setEpics(epics.map(e => e.id === epicId ? { ...e, [field]: value } : e));
  };

  // Edit story
  const handleEditStory = (epicId: string, storyId: string, field: keyof UserStory, value: any) => {
    setEpics(epics.map(e => {
      if (e.id === epicId) {
        return {
          ...e,
          stories: e.stories.map(s => s.id === storyId ? { ...s, [field]: value } : s),
        };
      }
      return e;
    }));
  };

  // Add acceptance criterion
  const handleAddAC = (epicId: string, storyId: string) => {
    setEpics(epics.map(e => {
      if (e.id === epicId) {
        return {
          ...e,
          stories: e.stories.map(s => 
            s.id === storyId 
              ? { ...s, acceptanceCriteria: [...s.acceptanceCriteria, 'New acceptance criterion'] } 
              : s
          ),
        };
      }
      return e;
    }));
  };

  // Remove acceptance criterion
  const handleRemoveAC = (epicId: string, storyId: string, acIndex: number) => {
    setEpics(epics.map(e => {
      if (e.id === epicId) {
        return {
          ...e,
          stories: e.stories.map(s => 
            s.id === storyId 
              ? { ...s, acceptanceCriteria: s.acceptanceCriteria.filter((_, i) => i !== acIndex) } 
              : s
          ),
        };
      }
      return e;
    }));
  };

  // Edit acceptance criterion
  const handleEditAC = (epicId: string, storyId: string, acIndex: number, value: string) => {
    setEpics(epics.map(e => {
      if (e.id === epicId) {
        return {
          ...e,
          stories: e.stories.map(s => 
            s.id === storyId 
              ? { 
                  ...s, 
                  acceptanceCriteria: s.acceptanceCriteria.map((ac, i) => i === acIndex ? value : ac) 
                } 
              : s
          ),
        };
      }
      return e;
    }));
  };

  // Handle export
  const handleExport = async () => {
    if (!integrationConfig) {
      setExportError('Integration configuration not loaded');
      return;
    }

    if (epics.length === 0) {
      setExportError('No epics to export');
      return;
    }

    setIsExporting(true);
    setExportError('');
    setExportSuccess('');
    setExportResult(null);

    try {
      let result;

      if (integrationConfig.defaultPlatform === 'jira') {
        if (!projectKey.trim()) {
          setExportError('Project key is required for Jira export');
          setIsExporting(false);
          return;
        }
        const response = await exportToJira(epics, projectKey);
        result = response.data;
        setExportSuccess(`Successfully exported ${result.created.length} items to Jira!`);
      } else {
        const response = await exportToServiceNow(epics);
        result = response.data;
        setExportSuccess(`Successfully exported ${result.created.length} items to ServiceNow!`);
      }

      setExportResult(result);
    } catch (error: any) {
      setExportError(error.response?.data?.error || error.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'upload'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" />
          1. Upload Files
        </button>
        <button
          onClick={() => setActiveTab('review')}
          disabled={epics.length === 0}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'review'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : epics.length === 0
              ? 'text-slate-400 cursor-not-allowed'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Eye className="w-4 h-4" />
          2. Review & Edit
        </button>
        <button
          onClick={() => setActiveTab('export')}
          disabled={epics.length === 0}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'export'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : epics.length === 0
              ? 'text-slate-400 cursor-not-allowed'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Send className="w-4 h-4" />
          3. Export
        </button>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-8 border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Upload Process Diagram or Documentation</h3>
            <p className="text-slate-600 mb-6">
              Upload ARIS XML/AML files, process diagrams (PNG/JPG), or markdown documentation to automatically extract epics and user stories.
            </p>

            {/* Drag and Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
              }`}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                  <p className="text-slate-600">Processing {selectedFile?.name}...</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-center gap-4 mb-4">
                    <Image className="w-12 h-12 text-slate-400" />
                    <FileCode className="w-12 h-12 text-slate-400" />
                    <FileText className="w-12 h-12 text-slate-400" />
                  </div>
                  <p className="text-lg text-slate-700 mb-2">
                    Drag and drop your file here, or{' '}
                    <label className="text-blue-600 hover:text-blue-700 cursor-pointer underline">
                      browse
                      <input
                        type="file"
                        className="hidden"
                        accept=".png,.jpg,.jpeg,.gif,.webp,.xml,.aml,.md,.txt"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </p>
                  <p className="text-sm text-slate-500">
                    Supported: Images (.png, .jpg), ARIS (.xml, .aml), Markdown (.md, .txt)
                  </p>
                  <p className="text-xs text-slate-400 mt-2">Maximum file size: 10MB</p>
                </>
              )}
            </div>

            {uploadError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Upload Failed</p>
                  <p className="text-sm text-red-700">{uploadError}</p>
                </div>
              </div>
            )}

            {processingResult && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">Successfully Processed</p>
                    <p className="text-sm text-green-700 mt-1">
                      Extracted {processingResult.epics.length} epic(s) and{' '}
                      {processingResult.epics.reduce((sum, e) => sum + e.stories.length, 0)} user story(ies)
                    </p>
                    <div className="text-xs text-green-600 mt-2 space-y-1">
                      <p>Processor: {processingResult.metadata.processorType}</p>
                      {processingResult.metadata.provider && (
                        <p>LLM Provider: {processingResult.metadata.provider} ({processingResult.metadata.modelUsed})</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Supported File Types */}
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-3">Supported File Types</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <Image className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-slate-900">Process Diagrams</p>
                  <p className="text-sm text-slate-600">.png, .jpg, .jpeg, .gif, .webp</p>
                  <p className="text-xs text-slate-500 mt-1">Uses Vision AI to extract flows</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileCode className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-slate-900">ARIS Exports</p>
                  <p className="text-sm text-slate-600">.xml, .aml</p>
                  <p className="text-xs text-slate-500 mt-1">Parses hierarchical process models</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-slate-900">Documentation</p>
                  <p className="text-sm text-slate-600">.md, .txt</p>
                  <p className="text-xs text-slate-500 mt-1">Extracts structured user stories</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Tab */}
      {activeTab === 'review' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Review & Edit Extracted Items</h3>
                <p className="text-slate-600 text-sm mt-1">
                  {epics.length} epic(s), {epics.reduce((sum, e) => sum + e.stories.length, 0)} user story(ies)
                </p>
              </div>
              {processingResult && (
                <div className="text-right text-sm text-slate-500">
                  <p>File: {processingResult.metadata.fileName}</p>
                  <p>Processor: {processingResult.metadata.processorType}</p>
                </div>
              )}
            </div>

            {/* Epics and Stories */}
            <div className="space-y-6">
              {epics.map((epic) => (
                <div key={epic.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Epic Header */}
                  <div className="bg-blue-50 p-4 border-b border-slate-200">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-medium text-slate-600 mb-1 block">EPIC TITLE</label>
                        <input
                          type="text"
                          value={epic.title}
                          onChange={(e) => handleEditEpic(epic.id, 'title', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold text-slate-900"
                        />
                        <label className="text-xs font-medium text-slate-600 mt-3 mb-1 block">DESCRIPTION</label>
                        <textarea
                          value={epic.description}
                          onChange={(e) => handleEditEpic(epic.id, 'description', e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700"
                        />
                      </div>
                      <Edit2 className="w-4 h-4 text-slate-400 flex-shrink-0 mt-6" />
                    </div>
                  </div>

                  {/* Stories */}
                  <div className="divide-y divide-slate-200">
                    {epic.stories.map((story) => (
                      <div key={story.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">USER STORY</label>
                            <input
                              type="text"
                              value={story.title}
                              onChange={(e) => handleEditStory(epic.id, story.id, 'title', e.target.value)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-slate-900"
                            />
                          </div>
                          
                          <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">DESCRIPTION</label>
                            <textarea
                              value={story.description}
                              onChange={(e) => handleEditStory(epic.id, story.id, 'description', e.target.value)}
                              rows={2}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-700"
                            />
                          </div>

                          {/* Acceptance Criteria */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-medium text-slate-600">ACCEPTANCE CRITERIA</label>
                              <button
                                onClick={() => handleAddAC(epic.id, story.id)}
                                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                Add Criterion
                              </button>
                            </div>
                            <div className="space-y-2">
                              {story.acceptanceCriteria.map((ac, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <span className="text-slate-400 text-sm mt-2">•</span>
                                  <input
                                    type="text"
                                    value={ac}
                                    onChange={(e) => handleEditAC(epic.id, story.id, idx, e.target.value)}
                                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  />
                                  <button
                                    onClick={() => handleRemoveAC(epic.id, story.id, idx)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          {!integrationConfig ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-4">Loading integration configuration...</p>
            </div>
          ) : (
            <>
              {/* Platform Status Card */}
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  {integrationConfig.defaultPlatform === 'jira' ? (
                    <Database className="w-6 h-6 text-blue-600" />
                  ) : (
                    <Cloud className="w-6 h-6 text-green-600" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">
                      Export to {integrationConfig.defaultPlatform === 'jira' ? 'Jira' : 'ServiceNow'}
                    </h3>
                    <p className="text-sm text-slate-600">
                      Using pre-configured {integrationConfig.defaultPlatform === 'jira' ? 'Jira' : 'ServiceNow'} connection
                    </p>
                  </div>
                </div>

                {integrationConfig.defaultPlatform === 'jira' && integrationConfig.jira.configured && (
                  <div className="bg-blue-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Connected to Jira</span>
                    </div>
                    <div className="mt-2 text-sm text-blue-800">
                      <div>Instance: {integrationConfig.jira.baseUrl}</div>
                      <div>User: {integrationConfig.jira.email}</div>
                    </div>
                  </div>
                )}

                {integrationConfig.defaultPlatform === 'servicenow' && integrationConfig.servicenow.configured && (
                  <div className="bg-green-50 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="font-medium text-green-900">Connected to ServiceNow</span>
                    </div>
                    <div className="mt-2 text-sm text-green-800">
                      <div>Instance: {integrationConfig.servicenow.instanceUrl}</div>
                      <div>User: {integrationConfig.servicenow.username}</div>
                    </div>
                  </div>
                )}

                {/* Project Key Input (Jira only) */}
                {integrationConfig.defaultPlatform === 'jira' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Project Key *
                    </label>
                    <input
                      type="text"
                      value={projectKey}
                      onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                      placeholder="e.g., PROJ"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={isExporting}
                    />
                    <p className="text-xs text-slate-500">
                      Enter the Jira project key where epics and stories will be created
                    </p>
                  </div>
                )}

                {/* Export Button */}
                <button
                  onClick={handleExport}
                  disabled={isExporting || epics.length === 0 || (integrationConfig.defaultPlatform === 'jira' && !projectKey.trim())}
                  className="w-full mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                >
                  {isExporting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Push to {integrationConfig.defaultPlatform === 'jira' ? 'Jira' : 'ServiceNow'}
                    </>
                  )}
                </button>
              </div>

              {/* Export Results */}
              {exportSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">{exportSuccess}</span>
                  </div>
                </div>
              )}

              {exportError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800">
                    <XCircle className="w-5 h-5" />
                    <span className="font-medium">{exportError}</span>
                  </div>
                </div>
              )}

              {exportResult && exportResult.created.length > 0 && (
                <div className="bg-white rounded-lg border border-slate-200 p-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Successfully Created ({exportResult.created.length})
                  </h4>
                  <div className="space-y-2">
                    {exportResult.created.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.type === 'epic' ? '📦' : '📝'}</span>
                          <div>
                            <div className="font-medium text-slate-900">{item.title}</div>
                            <div className="text-sm text-slate-600">{item.remoteId}</div>
                          </div>
                        </div>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm font-medium"
                          >
                            View →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {exportResult && exportResult.failed.length > 0 && (
                <div className="bg-white rounded-lg border border-red-200 p-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2 text-red-600">
                    <XCircle className="w-5 h-5" />
                    Failed Items ({exportResult.failed.length})
                  </h4>
                  <div className="space-y-2">
                    {exportResult.failed.map((item, index) => (
                      <div key={index} className="p-3 bg-red-50 rounded-lg">
                        <div className="font-medium text-red-900">{item.title}</div>
                        <div className="text-sm text-red-700 mt-1">{item.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
