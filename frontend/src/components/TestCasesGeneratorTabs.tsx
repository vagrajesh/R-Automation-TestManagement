import { useState, useEffect } from 'react';
import { TestTubes, Sparkles, Copy, Check, AlertCircle, Loader, RefreshCw, Send, Download, FileText, List, Eye, Trash2, Plus } from 'lucide-react';
import { llmService } from '../services/llmService';
import { fetchDefaultIntegrationStories, type Story } from '../services/integrationService';
import { getModelsByProvider, type LLMProvider } from '../config/llmConfig';
import { FeatureFileGenerator } from './FeatureFileGenerator';

type Tab = 'select' | 'review' | 'export';

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
  story_id?: string;
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

export function TestCasesGeneratorTabs() {
  const [activeTab, setActiveTab] = useState<Tab>('select');
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingWithEval, setIsGeneratingWithEval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [numTestCases, setNumTestCases] = useState(3);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<string>>(new Set());
  const [showFeatureFileModal, setShowFeatureFileModal] = useState(false);
  const [qualitySummary, setQualitySummary] = useState<QualitySummary | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResults, setExportResults] = useState<any>(null);
  const [exportingTestCaseId, setExportingTestCaseId] = useState<string | null>(null);

  const configuredProviders = llmService.getConfiguredProviders();

  useEffect(() => {
    loadStories();
  }, []);

  const loadStories = async () => {
    setLoadingStories(true);
    setStoriesError(null);

    try {
      // Get integration config
      let integrationToUse: 'jira' | 'servicenow' = 'jira';
      let isIntegrationConnected = false;

      try {
        const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
        const response = await fetch(`${apiBaseUrl}/api/config`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
          const config = await response.json();
          
          integrationToUse = config.integrations?.defaultIntegration || 'jira';

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
      
      const fetchedStories = await fetchDefaultIntegrationStories(integrationToUse);
      setStories(fetchedStories);
      setDefaultIntegration(integrationToUse);
      console.log(`[Stories] Loaded ${fetchedStories.length} stories from ${integrationToUse}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load stories';
      setStoriesError(errorMessage);
      console.error('[Stories] Error:', errorMessage);
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
        version: tc.version || '1.0',
        story_id: selectedStory?.key || undefined,
      }));

      setGeneratedTestCases(formattedTestCases);
      setSuccess(`Successfully generated ${formattedTestCases.length} test cases!`);
      setActiveTab('review');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to generate test cases: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
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
        version: tc.version || '1.0',
        story_id: selectedStory?.key || undefined,
      }));

      setGeneratedTestCases(formattedTestCases);
      setQualitySummary(summary);
      
      const qualityMsg = summary?.averageScore 
        ? ` Quality score: ${(summary.averageScore * 100).toFixed(0)}%`
        : '';
      setSuccess(`Successfully generated ${formattedTestCases.length} test cases with quality evaluation!${qualityMsg}`);
      setActiveTab('review');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to generate test cases with evaluation: ${errorMessage}`);
    } finally {
      setIsGeneratingWithEval(false);
    }
  };

  const handleEditTestCase = (id: string, field: keyof GeneratedTestCase, value: any) => {
    setGeneratedTestCases(generatedTestCases.map(tc => 
      tc.id === id ? { ...tc, [field]: value } : tc
    ));
  };

  const handleDeleteTestCase = (id: string) => {
    setGeneratedTestCases(generatedTestCases.filter(tc => tc.id !== id));
    setSelectedTestCaseIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  const handleEditStep = (testCaseId: string, stepIndex: number, field: keyof StepData, value: any) => {
    setGeneratedTestCases(generatedTestCases.map(tc => {
      if (tc.id === testCaseId) {
        const newSteps = [...tc.steps];
        newSteps[stepIndex] = { ...newSteps[stepIndex], [field]: value };
        return { ...tc, steps: newSteps };
      }
      return tc;
    }));
  };

  const handleAddStep = (testCaseId: string) => {
    setGeneratedTestCases(generatedTestCases.map(tc => {
      if (tc.id === testCaseId) {
        const maxOrder = tc.steps.length > 0 ? Math.max(...tc.steps.map(s => s.order)) : 0;
        const newStep: StepData = {
          order: maxOrder + 100,
          step: '',
          expected_result: '',
          test_data: ''
        };
        return { ...tc, steps: [...tc.steps, newStep] };
      }
      return tc;
    }));
  };

  const handleDeleteStep = (testCaseId: string, stepIndex: number) => {
    setGeneratedTestCases(generatedTestCases.map(tc => {
      if (tc.id === testCaseId) {
        return { ...tc, steps: tc.steps.filter((_, idx) => idx !== stepIndex) };
      }
      return tc;
    }));
  };

  const handleSelectTestCase = (id: string) => {
    setSelectedTestCaseIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAllTestCases = () => {
    if (selectedTestCaseIds.size === generatedTestCases.length) {
      setSelectedTestCaseIds(new Set());
    } else {
      setSelectedTestCaseIds(new Set(generatedTestCases.map(tc => tc.id)));
    }
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

  const downloadJSON = () => {
    const selectedCases = generatedTestCases.filter(tc => selectedTestCaseIds.has(tc.id));
    const json = JSON.stringify(selectedCases, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-cases-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccess(`Downloaded ${selectedCases.length} test case(s) as JSON`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const exportToIntegration = async () => {
    const selectedCases = generatedTestCases.filter(tc => selectedTestCaseIds.has(tc.id));
    
    if (selectedCases.length === 0) {
      setError('Please select at least one test case to export');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsExporting(true);
    setError(null);
    setSuccess(null);
    setExportResults(null);

    try {
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
      const configResponse = await fetch(`${apiBaseUrl}/api/config`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });

      if (!configResponse.ok) {
        throw new Error('Failed to get integration configuration');
      }

      const config = await configResponse.json();
      const defaultIntegration = config.integrations?.defaultIntegration || 'jira';
      const isConnected = defaultIntegration === 'jira' 
        ? config.integrations?.jiraConfigured 
        : config.integrations?.serviceNowConfigured;

      if (!isConnected) {
        throw new Error(`${defaultIntegration === 'jira' ? 'Jira' : 'ServiceNow'} is not connected`);
      }

      // Add story_id to each test case if a story is selected
      const casesWithStoryId = selectedCases.map(tc => ({
        ...tc,
        story_id: selectedStory?.key || tc.story_id,
      }));

      const response = await fetch(`${apiBaseUrl}/api/test-cases/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          testCases: casesWithStoryId,
          integration: defaultIntegration,
          storyKey: selectedStory?.key,
        }),
      });

      if (!response.ok) {
        let errorMessage = `Export failed (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Response was not JSON (likely HTML error page)
          const text = await response.text();
          if (text.includes('<!DOCTYPE')) {
            errorMessage = `Server error: endpoint may not be available (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setExportResults(data);
      
      const integrationName = defaultIntegration === 'jira' ? 'Jira' : 'ServiceNow';
      setSuccess(`Successfully exported ${data.summary.created} test case(s) to ${integrationName}!`);
      
      console.log('[Export] Results:', data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to export test cases: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = (testCase: GeneratedTestCase) => {
    const text = JSON.stringify(testCase, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedId(testCase.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportSingleTestCase = async (testCase: GeneratedTestCase) => {
    setExportingTestCaseId(testCase.id);
    setError(null);
    setSuccess(null);

    try {
      const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
      const configResponse = await fetch(`${apiBaseUrl}/api/config`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });

      if (!configResponse.ok) {
        throw new Error('Failed to get integration configuration');
      }

      const config = await configResponse.json();
      const defaultIntegration = config.integrations?.defaultIntegration || 'jira';
      const isConnected = defaultIntegration === 'jira' 
        ? config.integrations?.jiraConfigured 
        : config.integrations?.serviceNowConfigured;

      if (!isConnected) {
        throw new Error(`${defaultIntegration === 'jira' ? 'Jira' : 'ServiceNow'} is not connected`);
      }

      const caseWithStoryId = {
        ...testCase,
        story_id: selectedStory?.key || testCase.story_id,
      };

      const response = await fetch(`${apiBaseUrl}/api/test-cases/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          testCases: [caseWithStoryId],
          integration: defaultIntegration,
          storyKey: selectedStory?.key,
        }),
      });

      if (!response.ok) {
        let errorMessage = `Export failed (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          const text = await response.text();
          if (text.includes('<!DOCTYPE')) {
            errorMessage = `Server error: endpoint may not be available (${response.status})`;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const integrationName = defaultIntegration === 'jira' ? 'Jira' : 'ServiceNow';
      setSuccess(`Exported "${testCase.name}" to ${integrationName}!`);
      
      console.log('[Export Single] Results:', data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to export test case: ${errorMessage}`);
    } finally {
      setExportingTestCaseId(null);
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
      if (score <= 0.2) return 'bg-green-100 text-green-700 border border-green-300';
      if (score <= 0.5) return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
      return 'bg-red-100 text-red-700 border border-red-300';
    }
    
    // For other metrics, higher is better
    if (score >= 0.8) return 'bg-green-100 text-green-700 border border-green-300';
    if (score >= 0.5) return 'bg-yellow-100 text-yellow-700 border border-yellow-300';
    return 'bg-red-100 text-red-700 border border-red-300';
  };

  const filteredStories = stories.filter(story =>
    story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    story.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TestTubes className="w-8 h-8 text-blue-600" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Test Cases Generator</h2>
          <p className="text-slate-600 mt-1">Generate test cases from Jira & ServiceNow stories using AI</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('select')}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'select'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <List className="w-4 h-4" />
          1. Select Story & Generate
        </button>
        <button
          onClick={() => setActiveTab('review')}
          disabled={generatedTestCases.length === 0}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'review'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : generatedTestCases.length === 0
              ? 'text-slate-400 cursor-not-allowed'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Eye className="w-4 h-4" />
          2. Review & Edit
        </button>
        <button
          onClick={() => setActiveTab('export')}
          disabled={generatedTestCases.length === 0}
          className={`px-6 py-3 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'export'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : generatedTestCases.length === 0
              ? 'text-slate-400 cursor-not-allowed'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Send className="w-4 h-4" />
          3. Export
        </button>
      </div>

      {/* Tab 1: Select Story & Generate */}
      {activeTab === 'select' && (
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
                <input
                  type="text"
                  placeholder="Search stories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {loadingStories && (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-slate-600">Loading stories...</span>
                </div>
              )}

              {storiesError && (
                <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>{storiesError}</div>
                </div>
              )}

              {!loadingStories && !storiesError && (
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {filteredStories.map((story) => (
                    <button
                      key={story.key}
                      onClick={() => setSelectedStory(story)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        selectedStory?.key === story.key
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
                      <span className="font-semibold text-slate-700">Story Key:</span>
                      <p className="text-slate-600 mt-1">{selectedStory.key}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Title:</span>
                      <p className="text-slate-600 mt-1">{selectedStory.title}</p>
                    </div>
                    {selectedStory.status && (
                      <div>
                        <span className="font-semibold text-slate-700">Status:</span>
                        <p className="text-slate-600 mt-1">{selectedStory.status}</p>
                      </div>
                    )}
                    {selectedStory.priority && (
                      <div>
                        <span className="font-semibold text-slate-700">Priority:</span>
                        <p className="text-slate-600 mt-1">{selectedStory.priority}</p>
                      </div>
                    )}
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
                            <li key={idx}>{criterion}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-400 mt-1 italic">No acceptance criteria defined</p>
                      )}
                    </div>
                    {selectedStory.epicKey && (
                      <div>
                        <span className="font-semibold text-slate-700">Epic:</span>
                        <p className="text-slate-600 mt-1">{selectedStory.epicKey}</p>
                        {selectedStory.epicTitle && (
                          <p className="text-slate-600 mt-1">{selectedStory.epicTitle}</p>
                        )}
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
      )}

      {/* Tab 2: Review & Edit */}
      {activeTab === 'review' && generatedTestCases.length > 0 && (
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Review & Edit Test Cases</h3>
            <button
              onClick={() => setActiveTab('export')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Proceed to Export
            </button>
          </div>

          {qualitySummary && qualitySummary.averageScore !== null && (
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h4 className="font-semibold text-slate-900 mb-3">Quality Summary</h4>
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
            </div>
          )}

          <div className="space-y-4">
            {generatedTestCases.map((testCase) => (
              <div key={testCase.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Test Case Name</label>
                        <input
                          type="text"
                          value={testCase.name}
                          onChange={(e) => handleEditTestCase(testCase.id, 'name', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Description</label>
                        <textarea
                          value={testCase.description}
                          onChange={(e) => handleEditTestCase(testCase.id, 'description', e.target.value)}
                          rows={2}
                          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Type</label>
                        <select
                          value={testCase.test_type}
                          onChange={(e) => handleEditTestCase(testCase.id, 'test_type', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="Positive">Positive</option>
                          <option value="Negative">Negative</option>
                          <option value="End to End">End to End</option>
                          <option value="Edge Cases">Edge Cases</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Priority</label>
                        <select
                          value={testCase.priority}
                          onChange={(e) => handleEditTestCase(testCase.id, 'priority', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="Critical">Critical</option>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">State</label>
                        <select
                          value={testCase.state}
                          onChange={(e) => handleEditTestCase(testCase.id, 'state', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="draft">Draft</option>
                          <option value="ready">Ready</option>
                          <option value="approved">Approved</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Version</label>
                        <input
                          type="text"
                          value={testCase.version || '1.0'}
                          onChange={(e) => handleEditTestCase(testCase.id, 'version', e.target.value)}
                          className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="1.0"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-600">Test Steps</label>
                        <button
                          onClick={() => handleAddStep(testCase.id)}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Add Step
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead className="bg-slate-100 border border-slate-300">
                            <tr>
                              <th className="px-4 py-3 text-center font-semibold text-slate-700 border border-slate-300 w-20">Step #</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700 border border-slate-300">Step Description</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700 border border-slate-300">Expected Result</th>
                              <th className="px-4 py-3 text-left font-semibold text-slate-700 border border-slate-300 w-48">Test Data</th>
                              <th className="px-4 py-3 text-center font-semibold text-slate-700 border border-slate-300 w-16">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {testCase.steps.map((step, idx) => (
                              <tr key={idx} className="bg-white hover:bg-slate-50 border border-slate-300">
                                <td className="px-4 py-3 text-center text-slate-700 font-semibold border border-slate-300 bg-slate-50">
                                  <div>{idx + 1}</div>
                                </td>
                                <td className="px-4 py-3 border border-slate-300">
                                  <div>
                                    <textarea
                                      value={step.step}
                                      onChange={(e) => handleEditStep(testCase.id, idx, 'step', e.target.value)}
                                      placeholder="Step description"
                                      rows={2}
                                      className="w-full px-2 py-1 text-sm text-slate-700 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-3 border border-slate-300">
                                  <div>
                                    <textarea
                                      value={step.expected_result}
                                      onChange={(e) => handleEditStep(testCase.id, idx, 'expected_result', e.target.value)}
                                      placeholder="Expected result"
                                      rows={2}
                                      className="w-full px-2 py-1 text-sm text-slate-700 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-3 border border-slate-300">
                                  <div>
                                    <input
                                      type="text"
                                      value={step.test_data}
                                      onChange={(e) => handleEditStep(testCase.id, idx, 'test_data', e.target.value)}
                                      placeholder="Test data (optional)"
                                      className="w-full px-2 py-1 text-sm text-slate-700 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center border border-slate-300">
                                  <button
                                    onClick={() => handleDeleteStep(testCase.id, idx)}
                                    className="text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                                    title="Delete step"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {testCase.quality && (
                      <div className="bg-blue-50 p-3 rounded border border-blue-200">
                        <div className="text-xs font-semibold text-blue-900 mb-2">Quality Metrics</div>
                        <div className="flex flex-wrap gap-3">
                          {testCase.quality.metrics.faithfulness && (
                            <div className="text-xs">
                              <span className="font-semibold">Faithfulness:</span>{' '}
                              <span className={`px-2 py-1 rounded ${getMetricBadgeClass(testCase.quality.metrics.faithfulness.score, 'faithfulness')}`}>
                                {formatMetricPercent(testCase.quality.metrics.faithfulness.score)}
                              </span>
                            </div>
                          )}
                          {testCase.quality.metrics.relevancy && (
                            <div className="text-xs">
                              <span className="font-semibold">Relevancy:</span>{' '}
                              <span className={`px-2 py-1 rounded ${getMetricBadgeClass(testCase.quality.metrics.relevancy.score, 'relevancy')}`}>
                                {formatMetricPercent(testCase.quality.metrics.relevancy.score)}
                              </span>
                            </div>
                          )}
                          {testCase.quality.metrics.hallucination && (
                            <div className="text-xs">
                              <span className="font-semibold">Hallucination:</span>{' '}
                              <span className={`px-2 py-1 rounded ${getMetricBadgeClass(testCase.quality.metrics.hallucination.score, 'hallucination')}`}>
                                {formatMetricPercent(testCase.quality.metrics.hallucination.score)}
                              </span>
                            </div>
                          )}
                          {testCase.quality.metrics.completeness && (
                            <div className="text-xs">
                              <span className="font-semibold">Completeness:</span>{' '}
                              <span className={`px-2 py-1 rounded ${getMetricBadgeClass(testCase.quality.metrics.completeness.score, 'completeness')}`}>
                                {formatMetricPercent(testCase.quality.metrics.completeness.score)}
                              </span>
                            </div>
                          )}
                          {testCase.quality.metrics.pii_leakage && (
                            <div className="text-xs">
                              <span className="font-semibold">PII Leakage:</span>{' '}
                              <span className={`px-2 py-1 rounded ${getMetricBadgeClass(testCase.quality.metrics.pii_leakage.score, 'pii_leakage')}`}>
                                {formatMetricPercent(testCase.quality.metrics.pii_leakage.score)}
                              </span>
                            </div>
                          )}
                        </div>
                        {testCase.quality.suggestions && testCase.quality.suggestions.length > 0 && (
                          <div className="mt-2 text-xs text-blue-800">
                            <div className="font-semibold">Suggestions:</div>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              {testCase.quality.suggestions.map((suggestion, idx) => (
                                <li key={idx}>{suggestion}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4 flex items-center gap-2">
                    <button
                      onClick={() => exportSingleTestCase(testCase)}
                      disabled={exportingTestCaseId === testCase.id}
                      className="p-2 text-green-600 hover:bg-green-50 disabled:text-gray-400 rounded-lg transition-colors"
                      title="Send this test case to integration"
                    >
                      {exportingTestCaseId === testCase.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteTestCase(testCase.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete test case"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Export */}
      {activeTab === 'export' && generatedTestCases.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 space-y-4">
            <h3 className="text-xl font-bold text-slate-900">Export Test Cases</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">Download Options</h4>
                <p className="text-sm text-slate-600 mb-3">Select test cases below and download</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={downloadJSON}
                    disabled={selectedTestCaseIds.size === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download JSON ({selectedTestCaseIds.size} selected)
                  </button>
                  <button
                    onClick={handleGenerateFeatureFile}
                    disabled={selectedTestCaseIds.size === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Generate Feature File ({selectedTestCaseIds.size} selected)
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">Integration Export</h4>
                <p className="text-sm text-slate-600 mb-3">Export to configured integration (Jira or ServiceNow)</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={exportToIntegration}
                    disabled={selectedTestCaseIds.size === 0 || isExporting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {isExporting ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Export to Integration ({selectedTestCaseIds.size} selected)
                      </>
                    )}
                  </button>
                </div>
                
                {exportResults && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-semibold text-blue-900 mb-2">Export Results</div>
                    <div className="text-xs space-y-1">
                      <div className="text-green-700">✓ Created: {exportResults.summary.created}</div>
                      {exportResults.summary.failed > 0 && (
                        <div className="text-red-700">✗ Failed: {exportResults.summary.failed}</div>
                      )}
                      {exportResults.created && exportResults.created.length > 0 && (
                        <div className="mt-2">
                          <div className="font-semibold text-blue-800 mb-1">Created Test Cases:</div>
                          {exportResults.created.map((item: any) => (
                            <div key={item.localId} className="text-blue-700">
                              <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                {item.remoteId}: {item.name}
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {success && (
              <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                <Check className="w-5 h-5 flex-shrink-0" />
                <div>{success}</div>
              </div>
            )}

            {error && (
              <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <div>{error}</div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-900">Preview & Select ({generatedTestCases.length} test cases)</h4>
                {selectedStory && (
                  <p className="text-sm text-slate-600 mt-1">Story: {selectedStory.key}</p>
                )}
              </div>
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
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Test Case Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Priority</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">State</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Version</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Steps</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {generatedTestCases.map((testCase) => (
                    <tr key={testCase.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedTestCaseIds.has(testCase.id)}
                          onChange={() => handleSelectTestCase(testCase.id)}
                          className="w-4 h-4 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{testCase.name}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-md truncate">
                        {testCase.description || testCase.short_description}
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
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-700 border border-slate-300 inline-block">
                          {testCase.state}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-700 border border-green-300 inline-block">
                          {testCase.version || '1.0'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{testCase.steps.length}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => copyToClipboard(testCase)}
                            className="p-2 text-slate-600 hover:text-blue-600 transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedId === testCase.id ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => exportSingleTestCase(testCase)}
                            disabled={exportingTestCaseId === testCase.id}
                            className="p-2 text-slate-600 hover:text-green-600 disabled:text-gray-400 transition-colors"
                            title="Send this test case to integration"
                          >
                            {exportingTestCaseId === testCase.id ? (
                              <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
