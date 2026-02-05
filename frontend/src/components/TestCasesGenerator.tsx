import React, { useState, useEffect } from 'react';
import { TestTubes, Sparkles, Copy, Check, AlertCircle, Loader, RefreshCw, ChevronDown, Send, Download, FileText } from 'lucide-react';
import { llmService } from '../services/llmService';
import { fetchDefaultIntegrationStories, type Story } from '../services/integrationService';
import { getModelsByProvider, type LLMProvider } from '../config/llmConfig';
import { FeatureFileGenerator } from './FeatureFileGenerator';

// Get API base URL from environment, defaults to localhost:8080
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface StepData {
  order: number;
  step: string;
  expected_result: string;
  test_data: string;
}

interface GeneratedTestCase {
  id: string;
  name: string;
  short_description: string;
  description: string;
  test_type: string;
  priority: string;
  state: string;
  version?: string;
  steps: StepData[];
  quality?: QualityMetrics;
}

// Quality evaluation interfaces
interface MetricScore {
  score: number;
  explanation: string;
}

interface QualityMetrics {
  overallScore: number;
  qualityLevel: 'high' | 'medium' | 'low';
  metrics: {
    faithfulness?: MetricScore;
    relevancy?: MetricScore;
    hallucination?: MetricScore;
    completeness?: MetricScore;
    pii_leakage?: MetricScore;
  };
  suggestions?: string[];
}

interface QualitySummary {
  averageScore: number | null;
  highQualityCount: number;
  mediumQualityCount: number;
  lowQualityCount: number;
  evaluationSkipped?: boolean;
}

export function TestCasesGenerator() {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [loadingStories, setLoadingStories] = useState(false);
  const [storiesError, setStoriesError] = useState<string | null>(null);
  const [, setDefaultIntegration] = useState<'jira' | 'servicenow'>('jira');

  const getPersistentProvider = (): LLMProvider => {
    const saved = localStorage.getItem('selected_llm_provider');
    const configuredProviders = llmService.getConfiguredProviders();
    
    if (saved && configuredProviders.includes(saved as LLMProvider)) {
      return saved as LLMProvider;
    }
    return configuredProviders.length > 0 ? configuredProviders[0] : 'openai';
  };

  const getPersistentModel = (provider: LLMProvider): string => {
    const saved = localStorage.getItem(`selected_llm_model_${provider}`);
    const availableModels = getModelsByProvider(provider);
    
    if (saved && availableModels.some(m => m.id === saved)) {
      return saved;
    }
    return availableModels[0]?.id || 'gpt-4-turbo';
  };

  const [selectedProvider, _setSelectedProvider] = useState<LLMProvider>(getPersistentProvider());
  const [selectedModel, _setSelectedModel] = useState(getPersistentModel(selectedProvider));
  const [generatedTestCases, setGeneratedTestCases] = useState<GeneratedTestCase[]>([]);
  const [generatedServiceNowTestCases, setGeneratedServiceNowTestCases] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingServiceNow, setIsGeneratingServiceNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [numTestCases, setNumTestCases] = useState(3);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTestCaseId, setExpandedTestCaseId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<string>>(new Set());
  const [showFeatureFileModal, setShowFeatureFileModal] = useState(false);
  const [isGeneratingWithEval, setIsGeneratingWithEval] = useState(false);
  const [qualitySummary, setQualitySummary] = useState<QualitySummary | null>(null);

  const configuredProviders = llmService.getConfiguredProviders();

  useEffect(() => {
    loadStories();
  }, []);

  useEffect(() => {
    localStorage.setItem('selected_llm_provider', selectedProvider);
  }, [selectedProvider]);

  useEffect(() => {
    localStorage.setItem(`selected_llm_model_${selectedProvider}`, selectedModel);
  }, [selectedModel, selectedProvider]);

  const handleSelectTestCase = (testCaseId: string) => {
    const newSelected = new Set(selectedTestCaseIds);
    if (newSelected.has(testCaseId)) {
      newSelected.delete(testCaseId);
    } else {
      newSelected.add(testCaseId);
    }
    setSelectedTestCaseIds(newSelected);
  };

  const handleSelectAllTestCases = () => {
    if (selectedTestCaseIds.size === generatedTestCases.length) {
      setSelectedTestCaseIds(new Set());
    } else {
      setSelectedTestCaseIds(new Set(generatedTestCases.map(tc => tc.id)));
    }
  };

  const handleSendToServiceNow = () => {
    const selectedCases = generatedTestCases.filter(tc => selectedTestCaseIds.has(tc.id));
    console.log('[TestCases] Send to ServiceNow:', selectedCases);
    setSuccess(`Ready to send ${selectedCases.length} test case(s) to ServiceNow`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleExportCSVExcel = () => {
    const selectedCases = generatedTestCases.filter(tc => selectedTestCaseIds.has(tc.id));
    console.log('[TestCases] Export to CSV/Excel:', selectedCases);
    setSuccess(`Ready to export ${selectedCases.length} test case(s) to CSV/Excel`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleGenerateFeatureFile = () => {
    const selectedCases = generatedTestCases.filter(tc => selectedTestCaseIds.has(tc.id));
    if (selectedCases.length === 0) {
      setError('Please select at least one test case');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setShowFeatureFileModal(true);
  };

  const loadStories = async () => {
    setLoadingStories(true);
    setStoriesError(null);

    try {
      // Fetch default integration from backend first
      let integrationToUse: 'jira' | 'servicenow' = 'jira';
      let isIntegrationConnected = false;
      
      try {
        const configResponse = await fetch(`${API_BASE_URL}/api/config`);
        if (configResponse.ok) {
          const config = await configResponse.json();
          integrationToUse = config.integrations?.defaultIntegration || 'jira';
          setDefaultIntegration(integrationToUse);
          
          // Check if default integration is connected
          if (integrationToUse === 'jira') {
            isIntegrationConnected = config.integrations?.jiraConfigured;
          } else {
            isIntegrationConnected = config.integrations?.serviceNowConfigured;
          }
        }
      } catch (configErr) {
        console.warn('[TestCasesGenerator] Failed to fetch config:', configErr);
        setStoriesError('Failed to load configuration. Please refresh the page.');
        setLoadingStories(false);
        return;
      }
      
      // Verify prerequisites - only check integration connection
      if (!isIntegrationConnected) {
        const integrationName = integrationToUse === 'jira' ? 'Jira' : 'ServiceNow';
        setStoriesError(`${integrationName} is not connected. Please check the connection status or credentials.`);
        setLoadingStories(false);
        return;
      }
      
      // Now fetch stories using the determined integration
      const fetchedStories = await fetchDefaultIntegrationStories(integrationToUse);
      setStories(fetchedStories);
      if (fetchedStories.length > 0) {
        setSelectedStory(fetchedStories[0]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load stories';
      setStoriesError(errorMessage);
    } finally {
      setLoadingStories(false);
    }
  };

  const generateTestCases = async () => {
    if (!selectedStory) {
      setError('Please select a story to generate test cases');
      return;
    }

    if (configuredProviders.length === 0) {
      setError('No LLM providers configured. Please configure at least one provider in Settings.');
      return;
    }

    const provider = configuredProviders.includes(selectedProvider) ? selectedProvider : configuredProviders[0];

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
      const response = await fetch(`${apiBaseUrl}/api/test-cases/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          story: selectedStory,
          numTestCases,
          provider,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error (${response.status})`);
      }

      const data = await response.json();
      const testCases = data.testCases;

      if (!Array.isArray(testCases) || testCases.length === 0) {
        throw new Error('No test cases returned from API');
      }

      console.log('[TestCases] Successfully received test cases:', testCases.length);

      const formattedTestCases = testCases.map((tc, idx) => ({
        ...tc,
        id: `gen-${Date.now()}-${idx}`,
      }));

      setGeneratedTestCases(formattedTestCases);
      setSuccess(`Successfully generated ${formattedTestCases.length} test cases!`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to generate test cases: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateServiceNowTestCases = async () => {
    if (!selectedStory) {
      setError('Please select a story to generate test cases');
      return;
    }

    if (configuredProviders.length === 0) {
      setError('No LLM providers configured. Please configure at least one provider in Settings.');
      return;
    }

    const provider = configuredProviders.includes(selectedProvider) ? selectedProvider : configuredProviders[0];

    setIsGeneratingServiceNow(true);
    setError(null);
    setSuccess(null);

    try {
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
      const response = await fetch(`${apiBaseUrl}/api/test-cases/generate-servicenow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          story: selectedStory,
          numTestCases,
          provider,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error (${response.status})`);
      }

      const data = await response.json();
      const testCases = data.testCases;

      if (!Array.isArray(testCases) || testCases.length === 0) {
        throw new Error('No test cases returned from API');
      }

      console.log('[ServiceNow TestCases] Successfully received test cases:', testCases.length);

      const formattedTestCases = testCases.map((tc, idx) => ({
        ...tc,
        id: `sn-gen-${Date.now()}-${idx}`,
      }));

      setGeneratedServiceNowTestCases(formattedTestCases);
      setSuccess(`Successfully generated ${formattedTestCases.length} ServiceNow AI test cases!`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to generate ServiceNow test cases: ${errorMessage}`);
    } finally {
      setIsGeneratingServiceNow(false);
    }
  };

  const generateTestCasesWithEval = async () => {
    if (!selectedStory) {
      setError('Please select a story to generate test cases');
      return;
    }

    if (configuredProviders.length === 0) {
      setError('No LLM providers configured. Please configure at least one provider in Settings.');
      return;
    }

    const provider = configuredProviders.includes(selectedProvider) ? selectedProvider : configuredProviders[0];

    setIsGeneratingWithEval(true);
    setError(null);
    setSuccess(null);
    setQualitySummary(null);

    try {
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
      const response = await fetch(`${apiBaseUrl}/api/test-cases/generate-with-eval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          story: selectedStory,
          numTestCases,
          provider,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error (${response.status})`);
      }

      const data = await response.json();
      const testCases = data.testCases;
      const summary = data.qualitySummary;

      if (!Array.isArray(testCases) || testCases.length === 0) {
        throw new Error('No test cases returned from API');
      }

      console.log('[TestCases+Eval] Successfully received test cases with quality:', testCases.length);

      const formattedTestCases = testCases.map((tc: any, idx: number) => ({
        ...tc,
        id: tc.id || `gen-eval-${Date.now()}-${idx}`,
      }));

      setGeneratedTestCases(formattedTestCases);
      setQualitySummary(summary);
      
      const qualityMsg = summary?.averageScore 
        ? ` Quality score: ${(summary.averageScore * 100).toFixed(0)}%`
        : '';
      setSuccess(`Successfully generated ${formattedTestCases.length} test cases with quality evaluation!${qualityMsg}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to generate test cases with evaluation: ${errorMessage}`);
    } finally {
      setIsGeneratingWithEval(false);
    }
  };

  const copyToClipboard = (testCase: GeneratedTestCase) => {
    const text = JSON.stringify(testCase, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedId(testCase.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const parseAcceptanceCriteria = (html: string): string[] => {
    if (!html) return [];
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const listItems = tempDiv.querySelectorAll('li');
    const items: string[] = [];
    listItems.forEach((li) => {
      const text = li.textContent?.trim() || '';
      if (text) items.push(text);
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
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      return cleanText;
    }
    return items;
  };

  const formatMetricPercent = (score?: number) =>
    typeof score === 'number' ? `${(score * 100).toFixed(0)}%` : '—';

  const getMetricBadgeClass = (score?: number, metricName?: string) => {
    if (typeof score !== 'number') return 'bg-slate-100 text-slate-500 border border-slate-200';
    
    // For hallucination and pii_leakage, lower is better (inverse logic)
    if (metricName === 'hallucination' || metricName === 'pii_leakage') {
      if (score <= 0.2) return 'bg-green-100 text-green-700 border border-green-300'; // 0-20%: No PII/hallucination
      if (score <= 0.5) return 'bg-yellow-100 text-yellow-700 border border-yellow-300'; // 20-50%: Some PII/hallucination
      return 'bg-red-100 text-red-700 border border-red-300'; // 50-100%: Significant PII/hallucination
    }
    
    // For other metrics, higher is better
    if (score >= 0.8) return 'bg-green-100 text-green-700 border border-green-300';
    if (score >= 0.5) return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
    return 'bg-red-100 text-red-700 border border-red-300';
  };

  const renderMetricBadge = (metric?: MetricScore, metricName?: string) => {
    if (!metric) {
      return <span className="text-xs text-slate-400">—</span>;
    }
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded ${getMetricBadgeClass(metric.score, metricName)}`}
        title={metric.explanation}
      >
        {formatMetricPercent(metric.score)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TestTubes className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Test Cases Generator</h2>
          <p className="text-slate-600 mt-1">Generate test cases from Jira & ServiceNow stories using AI</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Stories</h3>
              <button
                onClick={loadStories}
                disabled={loadingStories}
                className="p-2 text-slate-600 hover:text-slate-900 disabled:text-gray-400"
                title="Refresh stories"
              >
                <RefreshCw className={`w-4 h-4 ${loadingStories ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Number of Test Cases</label>
              <select
                value={numTestCases}
                onChange={(e) => setNumTestCases(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {[1, 2, 3, 5, 10].map((num) => (
                  <option key={num} value={num}>
                    {num} test case{num !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Search Stories</label>
              <input
                type="text"
                placeholder="Search by Story ID or text..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {storiesError && (
              <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>{storiesError}</div>
              </div>
            )}

            {loadingStories ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="w-5 h-5 animate-spin text-blue-600" />
              </div>
            ) : stories.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-slate-600">No stories found</p>
                <p className="text-xs text-slate-500 mt-2">Configure Jira or ServiceNow credentials</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {stories
                  .filter((story) => {
                    const searchLower = searchTerm.toLowerCase();
                    return (
                      story.key.toLowerCase().includes(searchLower) ||
                      story.title.toLowerCase().includes(searchLower) ||
                      story.description.toLowerCase().includes(searchLower)
                    );
                  })
                  .map((story) => (
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
        </div>

        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Selected Story</h3>
              {generatedTestCases.length > 0 && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                  {generatedTestCases.length} Test Case{generatedTestCases.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {selectedStory ? (
              <div className="space-y-4">
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
                    <p className="text-slate-600 mt-1 bg-slate-50 p-2 rounded max-h-32 overflow-y-auto">
                      {selectedStory.description}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Acceptance Criteria:</span>
                    {selectedStory.acceptanceCriteria ? (
                      <ul className="text-slate-600 mt-2 bg-slate-50 p-4 rounded max-h-40 overflow-y-auto space-y-2 list-disc list-inside">
                        {parseAcceptanceCriteria(selectedStory.acceptanceCriteria).map((criterion, idx) => (
                          <li key={idx} className="text-sm text-slate-700">
                            {criterion}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-500 italic mt-1">No acceptance criteria provided</p>
                    )}
                  </div>
                  {(selectedStory.epicKey || selectedStory.epicTitle) && (
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-semibold text-slate-900 mb-3">Epic Information</h4>
                      <div className="space-y-2">
                        {selectedStory.epicKey && (
                          <div>
                            <span className="font-semibold text-slate-700">Epic Number:</span>
                            <p className="text-slate-600 mt-1">{selectedStory.epicKey}</p>
                          </div>
                        )}
                        {selectedStory.epicTitle && (
                          <div>
                            <span className="font-semibold text-slate-700">Epic Short Description:</span>
                            <p className="text-slate-600 mt-1">{selectedStory.epicTitle}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={generateTestCases}
                  disabled={isGenerating || !selectedStory || configuredProviders.length === 0}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Test Cases
                    </>
                  )}
                </button>

                <button
                  onClick={generateServiceNowTestCases}
                  disabled={isGeneratingServiceNow || !selectedStory || configuredProviders.length === 0}
                  className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-semibold flex items-center justify-center gap-2 mt-3"
                >
                  {isGeneratingServiceNow ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate ServiceNow AI Test Cases
                    </>
                  )}
                </button>

                <button
                  onClick={generateTestCasesWithEval}
                  disabled={isGeneratingWithEval || !selectedStory || configuredProviders.length === 0}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors font-semibold flex items-center justify-center gap-2 mt-3"
                  title="Generate test cases and evaluate quality using DeepEval"
                >
                  {isGeneratingWithEval ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Generating & Evaluating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      ✨ Generate with Quality Evaluation
                    </>
                  )}
                </button>
              </div>
            ) : (
              <p className="text-slate-600 text-center py-8">Select a story to view details and generate test cases</p>
            )}
          </div>
        </div>
      </div>

      {generatedTestCases.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Generated Test Cases ({generatedTestCases.length})</h3>
            {qualitySummary && qualitySummary.averageScore !== null && (
              <div className="flex items-center gap-4 text-sm">
                <span className="font-semibold text-slate-700">Quality:</span>
                <span className="px-2 py-1 bg-slate-100 rounded">
                  Avg: {(qualitySummary.averageScore * 100).toFixed(0)}%
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                  ● High: {qualitySummary.highQualityCount}
                </span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                  ● Medium: {qualitySummary.mediumQualityCount}
                </span>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded">
                  ● Low: {qualitySummary.lowQualityCount}
                </span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="px-4 py-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={selectedTestCaseIds.size === generatedTestCases.length && generatedTestCases.length > 0}
                      onChange={handleSelectAllTestCases}
                      className="w-4 h-4 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-center w-10"></th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Test Case Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                  {/* <th className="px-4 py-3 text-center font-semibold text-slate-700">Quality</th> */}
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Faithfulness</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Relevancy</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Hallucination</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Completeness</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">PII Leakage</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Priority</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Story ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Epic Number</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700" title="Epic Short Description">Epic Description</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {generatedTestCases.map((testCase) => (
                  <React.Fragment key={testCase.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedTestCaseIds.has(testCase.id)}
                          onChange={() => handleSelectTestCase(testCase.id)}
                          className="w-4 h-4 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 text-center cursor-pointer">
                        <ChevronDown
                          className={`w-5 h-5 text-slate-400 transition-transform inline ${
                            expandedTestCaseId === testCase.id ? 'rotate-180' : ''
                          }`}
                          onClick={() => setExpandedTestCaseId(expandedTestCaseId === testCase.id ? null : testCase.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{testCase.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {testCase.description || testCase.short_description}
                      </td>
                      {/* <td className="px-4 py-3 text-center">
                        {testCase.quality ? (
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`px-2 py-1 text-xs font-bold rounded-full ${
                                testCase.quality.qualityLevel === 'high'
                                  ? 'bg-green-100 text-green-700 border border-green-300'
                                  : testCase.quality.qualityLevel === 'medium'
                                  ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                                  : 'bg-red-100 text-red-700 border border-red-300'
                              }`}
                              title={[
                                `Faithfulness: ${formatMetricPercent(testCase.quality.metrics.faithfulness?.score)}`,
                                `Relevancy: ${formatMetricPercent(testCase.quality.metrics.relevancy?.score)}`,
                                `Hallucination: ${formatMetricPercent(testCase.quality.metrics.hallucination?.score)}`,
                                `Completeness: ${formatMetricPercent(testCase.quality.metrics.completeness?.score)}`,
                                `PII Leakage: ${formatMetricPercent(testCase.quality.metrics.pii_leakage?.score)}`,
                              ].join('\n')}
                            >
                              {(testCase.quality.overallScore * 100).toFixed(0)}%
                            </span>
                            {testCase.quality.qualityLevel === 'low' && (
                              <span className="text-xs text-red-600">⚠️</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td> */}
                      <td className="px-4 py-3 text-center">
                        {renderMetricBadge(testCase.quality?.metrics.faithfulness, 'faithfulness')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {renderMetricBadge(testCase.quality?.metrics.relevancy, 'relevancy')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {renderMetricBadge(testCase.quality?.metrics.hallucination, 'hallucination')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {renderMetricBadge(testCase.quality?.metrics.completeness, 'completeness')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {renderMetricBadge(testCase.quality?.metrics.pii_leakage, 'pii_leakage')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-100 text-blue-700 border border-blue-300 inline-block">
                          {testCase.test_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-100 text-orange-700 border border-orange-300 inline-block">
                          {testCase.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-sm" title={selectedStory?.key}>
                        {selectedStory?.key || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-sm" title={selectedStory?.epicKey}>
                        {selectedStory?.epicKey || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600" title={selectedStory?.epicTitle}>
                        {selectedStory?.epicTitle || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => copyToClipboard(testCase)}
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === testCase.id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expandable Row - Full Test Case Details */}
                    {expandedTestCaseId === testCase.id && (
                      <tr className="bg-slate-50 border-l-4 border-blue-500">
                        <td colSpan={15} className="px-4 py-4">
                          <div className="space-y-6">
                            {testCase.description ? (
                              <div className="space-y-2">
                                <h4 className="font-bold text-slate-900">Description</h4>
                                <p className="text-sm text-slate-700 bg-white p-3 rounded border border-slate-200">
                                  {String(testCase.description)}
                                </p>
                              </div>
                            ) : null}

                            {(testCase.steps && testCase.steps.length > 0) ? (
                              <div className="space-y-3">
                                <h4 className="font-bold text-slate-900 text-md border-b-2 border-purple-500 pb-2">Test Steps ({testCase.steps.length})</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs border-collapse">
                                    <thead className="bg-slate-200 border border-slate-300">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-800 border border-slate-300 w-16">Step #</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-800 border border-slate-300">Step Description</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-800 border border-slate-300">Expected Result</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-800 border border-slate-300 w-32">Test Data</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-300">
                                      {testCase.steps
                                        .sort((a, b) => a.order - b.order)
                                        .map((step, idx) => (
                                          <tr key={idx} className="bg-white hover:bg-slate-50 border border-slate-300">
                                            <td className="px-3 py-2 text-slate-700 font-bold border border-slate-300 bg-slate-50">{step.order}</td>
                                            <td className="px-3 py-2 text-slate-600 border border-slate-300 whitespace-normal">{step.step}</td>
                                            <td className="px-3 py-2 text-slate-600 border border-slate-300 whitespace-normal">{step.expected_result}</td>
                                            <td className="px-3 py-2 text-slate-600 border border-slate-300 whitespace-normal text-xs bg-slate-50 font-mono">
                                              {step.test_data || '—'}
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                                No test steps available. The LLM did not include step details in the response.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {generatedTestCases.length > 0 && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium text-slate-700">
                  {selectedTestCaseIds.size > 0 ? (
                    <>
                      <span className="font-semibold text-blue-600">{selectedTestCaseIds.size}</span>
                      {' '}test case{selectedTestCaseIds.size !== 1 ? 's' : ''} selected
                    </>
                  ) : (
                    <span className="text-slate-500">Select test cases to perform bulk actions</span>
                  )}
                </div>
                {selectedTestCaseIds.size > 0 && (
                  <div className="flex gap-3">
                    <button
                      onClick={handleSendToServiceNow}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      <Send className="w-4 h-4" />
                      Send to ServiceNow
                    </button>
                    <button
                      onClick={handleExportCSVExcel}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV/Excel
                    </button>
                    <button
                      onClick={handleGenerateFeatureFile}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      Generate Feature File
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {generatedServiceNowTestCases.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 space-y-4">
          <h3 className="font-semibold text-slate-900">Generated ServiceNow AI Test Cases ({generatedServiceNowTestCases.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-green-100 border-b border-green-300">
                <tr>
                  <th className="px-4 py-3 text-center w-10"></th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Test Case Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Priority</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Version</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">State</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Story ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Epic Number</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Epic Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {generatedServiceNowTestCases.map((testCase) => (
                  <React.Fragment key={testCase.id}>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center cursor-pointer">
                        <ChevronDown
                          className={`w-5 h-5 text-slate-400 transition-transform inline ${
                            expandedTestCaseId === testCase.id ? 'rotate-180' : ''
                          }`}
                          onClick={() => setExpandedTestCaseId(expandedTestCaseId === testCase.id ? null : testCase.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{testCase.testData?.name}</td>
                      <td className="px-4 py-3 text-slate-600">{testCase.testData?.short_description}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-700 border border-purple-300 inline-block">
                          {testCase.testData?.test_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-100 text-orange-700 border border-orange-300 inline-block">
                          {testCase.testData?.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-700">{testCase.versionData?.version || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 border border-slate-300 inline-block">
                          {testCase.versionData?.state || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-sm">{selectedStory?.key || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{selectedStory?.epicKey || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-sm truncate">{selectedStory?.epicTitle || '—'}</td>
                    </tr>

                    {expandedTestCaseId === testCase.id && (
                      <tr className="bg-green-50 border-l-4 border-green-500">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="space-y-6">
                            {testCase.stepsData && testCase.stepsData.length > 0 && (
                              <div className="space-y-3">
                                <h4 className="font-bold text-slate-900 text-md border-b-2 border-green-500 pb-2">Test Steps ({testCase.stepsData.length})</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs border-collapse">
                                    <thead className="bg-slate-200 border border-slate-300">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-800 border border-slate-300 w-16">Step #</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-800 border border-slate-300">Step Description</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-800 border border-slate-300">Expected Result</th>
                                        <th className="px-3 py-2 text-left font-semibold text-slate-800 border border-slate-300 w-32">Test Data</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-300">
                                      {testCase.stepsData
                                        .sort((a: any, b: any) => a.order - b.order)
                                        .map((step: any, idx: number) => (
                                          <tr key={idx} className="bg-white hover:bg-slate-50 border border-slate-300">
                                            <td className="px-3 py-2 text-slate-700 font-bold border border-slate-300 bg-slate-50">{step.order}</td>
                                            <td className="px-3 py-2 text-slate-600 border border-slate-300 whitespace-normal">{step.step}</td>
                                            <td className="px-3 py-2 text-slate-600 border border-slate-300 whitespace-normal">{step.expected_result}</td>
                                            <td className="px-3 py-2 text-slate-600 border border-slate-300 whitespace-normal text-xs bg-slate-50 font-mono">
                                              {step.test_data || '—'}
                                            </td>
                                          </tr>
                                        ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 How it works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Stories are automatically fetched from configured Jira and ServiceNow instances</li>
          <li>• Select a story from the list to view its details</li>
          <li>• Choose an LLM provider and model for test case generation</li>
          <li>• AI generates comprehensive test cases with structured steps and test data</li>
          <li>• Select test cases and export them to CSV, Excel, or generate Gherkin Feature files</li>
        </ul>
      </div>

      {showFeatureFileModal && (
        <FeatureFileGenerator
          testCases={Array.from(selectedTestCaseIds)
            .map((id) => generatedTestCases.find((tc) => tc.id === id))
            .filter((tc): tc is GeneratedTestCase => tc !== undefined)}
          story={selectedStory}
          onClose={() => setShowFeatureFileModal(false)}
          currentLLMProvider={selectedProvider}
        />
      )}
    </div>
  );
}
