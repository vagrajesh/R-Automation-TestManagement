import { useState, useEffect } from 'react';
import { Sparkles, Loader, AlertCircle, Check } from 'lucide-react';
import type { Story } from '../services/integrationService';
import { fetchDefaultIntegrationStories } from '../services/integrationService';

// Get API base URL from environment, defaults to localhost:8080
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export function RequirementAnalysis() {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [defaultIntegration, setDefaultIntegration] = useState<'jira' | 'servicenow'>('jira');

  useEffect(() => {
    const loadStories = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch default integration from backend first
        let integrationToUse: 'jira' | 'servicenow' = 'jira';
        let isIntegrationConnected = false;
        let llmConfigured = false;
        
        try {
          const configResponse = await fetch(`${API_BASE_URL}/api/config`);
          if (configResponse.ok) {
            const config = await configResponse.json();
            integrationToUse = config.integrations?.defaultIntegration || 'jira';
            setDefaultIntegration(integrationToUse);
            
            // Check if LLM is configured
            llmConfigured = config.llm?.configuredProviders?.length > 0;
            
            // Check if default integration is connected
            if (integrationToUse === 'jira') {
              isIntegrationConnected = config.integrations?.jiraConfigured;
            } else {
              isIntegrationConnected = config.integrations?.serviceNowConfigured;
            }
          }
        } catch (configErr) {
          console.warn('[RequirementAnalysis] Failed to fetch config:', configErr);
          setError('Failed to load configuration. Please refresh the page.');
          setLoading(false);
          return;
        }
        
        // Verify prerequisites
        if (!llmConfigured) {
          setError('No LLM provider configured. Please configure an LLM provider in settings.');
          setLoading(false);
          return;
        }
        
        if (!isIntegrationConnected) {
          const integrationName = integrationToUse === 'jira' ? 'Jira' : 'ServiceNow';
          setError(`${integrationName} is not connected. Please check the connection status or credentials.`);
          setLoading(false);
          return;
        }
        
        // Now fetch stories using the determined integration
        const fetchedStories = await fetchDefaultIntegrationStories(integrationToUse);
        setStories(fetchedStories);
        if (fetchedStories.length > 0) {
          setSelectedStory(fetchedStories[0]);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load stories';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadStories();
  }, []);

  const filteredStories = stories.filter(
    (story) =>
      story.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserStoryAnalysis = async () => {
    console.log('[User Story Analysis] Button clicked');
    
    if (!selectedStory) {
      console.log('[User Story Analysis] No story selected');
      setError('Please select a story to analyze');
      return;
    }

    try {
      console.log('[User Story Analysis] Starting analysis for story:', selectedStory.key);
      setIsAnalyzing(true);
      setError(null);
      setSuccess(null);
      setAnalysisResult(null);

      const { llmService } = await import('../services/llmService');
      const configuredProviders = llmService.getConfiguredProviders();
      console.log('[User Story Analysis] Configured providers:', configuredProviders);

      if (configuredProviders.length === 0) {
        console.log('[User Story Analysis] No providers configured');
        setError('No LLM providers configured. Please configure at least one provider in Settings.');
        return;
      }

      const provider = configuredProviders[0];
      const config = llmService.getConfig(provider);
      console.log('[User Story Analysis] Using provider:', provider, 'with model:', config?.model);

      if (!config) {
        console.log('[User Story Analysis] Provider config not found');
        setError(`Provider ${provider} is not properly configured`);
        return;
      }

      // Call backend API instead of direct LLM
      console.log('[User Story Analysis] Calling /api/user-story/analyze');
      const response = await fetch(`${API_BASE_URL}/api/user-story/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          story: selectedStory,
          provider,
          model: config.model,
        }),
      });

      console.log('[User Story Analysis] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.log('[User Story Analysis] API error:', errorData);
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      console.log('[User Story Analysis] Analysis complete, setting result');
      setAnalysisResult(data.analysis);
      setSuccess('User story analysis completed successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      console.error('[User Story Analysis] Error:', err);
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const parseAcceptanceCriteria = (html: string): string[] => {
    if (!html) return [];
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const listItems = tempDiv.querySelectorAll('li');
    const items: string[] = [];
    
    listItems.forEach((li) => {
      const text = li.textContent?.trim() || '';
      if (text) {
        items.push(text);
      }
    });
    
    if (items.length === 0) {
      const cleanText = html
        .replace(/<[^>]*>/g, '')
        .replace(/&#\d+;/g, (match) => {
          const code = parseInt(match.substring(2, match.length - 1));
          return String.fromCharCode(code);
        })
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
      
      return [cleanText].filter((text) => text.length > 0);
    }
    
    return items;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Sparkles className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Requirement Analysis</h2>
          <p className="text-slate-600 mt-1">Analyze user stories from Jira & ServiceNow using AI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 text-lg">Stories</h3>
          
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Search Stories</label>
            <input
              type="text"
              placeholder="Search by Story ID or text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-5 h-5 animate-spin text-blue-600" />
            </div>
          ) : filteredStories.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-600">No stories found</p>
              <p className="text-xs text-slate-500 mt-2">Configure Jira or ServiceNow credentials</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredStories.map((story) => (
                <button
                  key={`${story.source}-${story.id}`}
                  onClick={() => setSelectedStory(story)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedStory?.id === story.id && selectedStory?.source === story.source
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900 truncate">{story.key}</div>
                  <div className="text-xs text-slate-600 mt-1 line-clamp-2">{story.title}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
          {selectedStory ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Selected Story</h3>
              </div>

              {error && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>{error}</div>
                </div>
              )}

              {success && (
                <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>{success}</div>
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-semibold text-slate-700">Key:</span>
                  <p className="text-slate-600 mt-1">{selectedStory.key}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Title:</span>
                  <p className="text-slate-600 mt-1">{selectedStory.title}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="font-semibold text-slate-700">Status:</span>
                    <span className="ml-2 px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                      {selectedStory.status}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Priority:</span>
                    <span className="ml-2 px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                      {selectedStory.priority}
                    </span>
                  </div>
                </div>
                {selectedStory.assignee && (
                  <div>
                    <span className="font-semibold text-slate-700">Assignee:</span>
                    <p className="text-slate-600 mt-1">{selectedStory.assignee}</p>
                  </div>
                )}
                <div>
                  <span className="font-semibold text-slate-700">Description:</span>
                  <p className="text-slate-600 mt-1 bg-slate-50 p-2 rounded max-h-24 overflow-y-auto">
                    {selectedStory.description}
                  </p>
                </div>
                {selectedStory.acceptanceCriteria && (
                  <div>
                    <span className="font-semibold text-slate-700">Acceptance Criteria:</span>
                    <ul className="text-slate-600 mt-2 bg-slate-50 p-3 rounded max-h-32 overflow-y-auto space-y-2 list-disc list-inside text-sm">
                      {parseAcceptanceCriteria(selectedStory.acceptanceCriteria).map((criterion, idx) => (
                        <li key={idx} className="text-slate-700">
                          {criterion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedStory && (selectedStory.epicKey || selectedStory.epicTitle) && (
                  <div className="space-y-2 pt-3 border-t border-slate-200">
                    <h4 className="font-semibold text-slate-900">Epic Information</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-semibold text-slate-700">Epic Number:</span>
                        <p className="text-slate-600 mt-1">{selectedStory.epicKey || '-'}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700">Epic Short Description:</span>
                        <p className="text-slate-600 mt-1 truncate" title={selectedStory.epicTitle}>
                          {selectedStory.epicTitle || '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleUserStoryAnalysis}
                disabled={isAnalyzing || !selectedStory}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-semibold flex items-center justify-center gap-2 mt-6"
              >
                {isAnalyzing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    User Story Analysis
                  </>
                )}
              </button>
            </div>
          ) : (
            <p className="text-slate-600 text-center py-8">Select a story to view details and perform analysis</p>
          )}
        </div>
      </div>

      {analysisResult && (
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Analysis Results</h3>
          <div className="bg-slate-50 p-4 rounded-lg whitespace-pre-wrap text-slate-700 max-h-96 overflow-y-auto text-sm border border-slate-200">
            {analysisResult}
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 How it works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Stories are automatically fetched from configured Jira and ServiceNow instances</li>
          <li>• Search and select a story to view its complete details</li>
          <li>• Click "User Story Analysis" to analyze the requirement using AI</li>
          <li>• Review the comprehensive analysis results including acceptance criteria validation</li>
        </ul>
      </div>
    </div>
  );
}
