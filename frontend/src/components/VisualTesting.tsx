import { useState, useEffect } from 'react';
import { Eye, Plus, Play, Clock, CheckCircle, XCircle, Loader, AlertCircle, Upload, Zap, Folder, Bot, Search, X } from 'lucide-react';
import { visualTestingService, type Project, type Baseline, type TestRun } from '../services/visualTestingService';

export function VisualTesting() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [allBaselines, setAllBaselines] = useState<Baseline[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [pixelResults, setPixelResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Form states
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateBaseline, setShowCreateBaseline] = useState(false);
  const [showRunTest, setShowRunTest] = useState(false);
  const [runTestLoading, setRunTestLoading] = useState(false);
  const [showPixelCompare, setShowPixelCompare] = useState(false);
  const [pixelCompareLoading, setPixelCompareLoading] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [selectedAiExplanation, setSelectedAiExplanation] = useState<any>(null);
  const [showDiffImage, setShowDiffImage] = useState(false);
  const [selectedDiffImage, setSelectedDiffImage] = useState<string | null>(null);
  const [showBaselineImage, setShowBaselineImage] = useState(false);
  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(null);

  // Dynamic content states
  const [disableAnimations, setDisableAnimations] = useState(false);
  const [blockAds, setBlockAds] = useState(false);
  const [scrollToTriggerLazyLoad, setScrollToTriggerLazyLoad] = useState(false);
  const [multipleScreenshots, setMultipleScreenshots] = useState(false);
  const [stabilityCheck, setStabilityCheck] = useState(false);
  const [maskSelectors, setMaskSelectors] = useState<string>('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Dynamic content states for baseline
  const [baselineDisableAnimations, setBaselineDisableAnimations] = useState(false);
  const [baselineBlockAds, setBaselineBlockAds] = useState(false);
  const [baselineScrollToTriggerLazyLoad, setBaselineScrollToTriggerLazyLoad] = useState(false);
  const [baselineMaskSelectors, setBaselineMaskSelectors] = useState<string>('');
  const [baselineShowAdvancedSettings, setBaselineShowAdvancedSettings] = useState(false);

  const resetDynamicContentState = () => {
    setDisableAnimations(false);
    setBlockAds(false);
    setScrollToTriggerLazyLoad(false);
    setMultipleScreenshots(false);
    setStabilityCheck(false);
    setMaskSelectors('');
    setShowAdvancedSettings(false);
  };

  useEffect(() => {
    checkConnection();
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadBaselines(selectedProject.id);
    }
  }, [selectedProject]);

  const checkConnection = async () => {
    const connected = await visualTestingService.checkHealth();
    setIsConnected(connected);
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsData = await visualTestingService.getProjects();
      setProjects(projectsData);
      if (projectsData.length > 0 && !selectedProject) {
        setSelectedProject(projectsData[0]);
      }
      
      // Load all baselines for dropdowns
      const allBaselinesData = [];
      for (const project of projectsData) {
        const projectBaselines = await visualTestingService.getBaselines(project.id);
        allBaselinesData.push(...projectBaselines);
      }
      setAllBaselines(allBaselinesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const loadBaselines = async (projectId: string) => {
    try {
      const baselinesData = await visualTestingService.getBaselines(projectId);
      setBaselines(baselinesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load baselines');
    }
  };

  const handleCreateProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const project = await visualTestingService.createProject({
        name: formData.get('name') as string,
        baseUrl: formData.get('baseUrl') as string,
        diffThreshold: Number(formData.get('diffThreshold')) || 95,
        aiEnabled: formData.get('aiEnabled') === 'on',
      });
      
      setProjects([...projects, project]);
      setSelectedProject(project);
      setShowCreateProject(false);
      setSuccess('Project created successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  const handleCreateBaseline = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const projectId = formData.get('projectId') as string;
    
    // Prepare dynamic content configuration for baseline
    const dynamicContent: any = {};
    if (baselineDisableAnimations) dynamicContent.disableAnimations = true;
    if (baselineBlockAds) dynamicContent.blockAds = true;
    if (baselineScrollToTriggerLazyLoad) dynamicContent.scrollToTriggerLazyLoad = true;
    if (baselineMaskSelectors.trim()) {
      dynamicContent.maskSelectors = baselineMaskSelectors.split(',').map(s => s.trim()).filter(s => s);
    }
    
    try {
      const baseline = await visualTestingService.createBaseline({
        projectId,
        name: formData.get('name') as string,
        image: formData.get('image') as File,
        viewport: {
          width: Number(formData.get('width')) || 1500,
          height: Number(formData.get('height')) || 1280,
        },
        url: formData.get('url') as string,
        tags: formData.get('tags') ? (formData.get('tags') as string).split(',').map(t => t.trim()) : [],
        dynamicContent: Object.keys(dynamicContent).length > 0 ? dynamicContent : undefined,
      });
      
      setBaselines([...baselines, baseline]);
      setAllBaselines([...allBaselines, baseline]);
      setShowCreateBaseline(false);
      
      // Reset dynamic content state
      setBaselineDisableAnimations(false);
      setBaselineBlockAds(false);
      setBaselineScrollToTriggerLazyLoad(false);
      setBaselineMaskSelectors('');
      setBaselineShowAdvancedSettings(false);
      
      setSuccess('Baseline created successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create baseline');
    }
  };

  const handleRunTest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const projectId = formData.get('projectId') as string;
    
    // Prepare dynamic content configuration
    const dynamicContent: any = {};
    if (disableAnimations) dynamicContent.disableAnimations = true;
    if (blockAds) dynamicContent.blockAds = true;
    if (scrollToTriggerLazyLoad) dynamicContent.scrollToTriggerLazyLoad = true;
    if (multipleScreenshots) dynamicContent.multipleScreenshots = true;
    if (stabilityCheck) dynamicContent.stabilityCheck = true;
    if (maskSelectors.trim()) {
      dynamicContent.maskSelectors = maskSelectors.split(',').map(s => s.trim()).filter(s => s);
    }
    
    try {
      setRunTestLoading(true);
      const testResult = await visualTestingService.runTest({
        projectId,
        url: formData.get('url') as string,
        baselineId: formData.get('baselineId') as string || undefined,
        viewport: {
          width: Number(formData.get('width')) || 1500,
          height: Number(formData.get('height')) || 1280,
        },
        priority: (formData.get('priority') as 'HIGH' | 'NORMAL' | 'LOW') || 'NORMAL',
        dynamicContent: Object.keys(dynamicContent).length > 0 ? {
          ...dynamicContent,
          maskSelectors: dynamicContent.maskSelectors
        } : undefined,
      });
      
      setShowRunTest(false);
      setSuccess(`Test queued successfully (ID: ${testResult.testId})`);
      setTimeout(() => setSuccess(null), 5000);
      
      // Reset dynamic content state
      resetDynamicContentState();
      
      // Poll for test status
      pollTestStatus(testResult.testId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run test');
    } finally {
      setRunTestLoading(false);
    }
  };

  const handlePixelCompare = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const projectId = formData.get('projectId') as string;
    const baselineId = formData.get('baselineId') as string;
    
    try {
      setPixelCompareLoading(true);
      const result = await visualTestingService.pixelCompare({
        projectId,
        baselineId,
        url: formData.get('url') as string,
        viewport: {
          width: Number(formData.get('width')) || 1500,
          height: Number(formData.get('height')) || 1280,
        },
        threshold: Number(formData.get('threshold')) || 0.1,
      });
      
      setShowPixelCompare(false);
      setSuccess(`Pixel comparison completed: ${result.isDifferent ? 'Different' : 'Same'} (${result.similarityScore.toFixed(1)}% similar)`);
      setTimeout(() => setSuccess(null), 5000);
      
      // Add to pixel results
      setPixelResults(prev => [result, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare pixels');
    } finally {
      setPixelCompareLoading(false);
    }
  };
  const pollTestStatus = async (testId: string) => {
    const maxAttempts = 60;
    let attempts = 0;
    
    const poll = async () => {
      try {
        const testRun = await visualTestingService.getTestStatus(testId);
        
        setTestRuns(prev => {
          const existing = prev.find(t => t.id === testId);
          if (existing) {
            return prev.map(t => t.id === testId ? testRun : t);
          }
          return [...prev, testRun];
        });
        
        if (testRun.status === 'COMPLETED') {
          setSuccess(`Test completed! ${testRun.diffResult?.isDifferent ? 'Differences detected' : 'No differences found'}`);
          setTimeout(() => setSuccess(null), 5000);
          return;
        }
        
        if (testRun.status === 'FAILED') {
          setError(`Test failed: ${testRun.diffResult?.explanation || 'Unknown error'}`);
          return;
        }
        
        if ((testRun.status === 'RUNNING' || testRun.status === 'QUEUED') && attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 5000);
        } else if (attempts >= maxAttempts) {
          setError('Test polling timeout - check backend logs');
        }
      } catch (err) {
        console.error('Failed to poll test status:', err);
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 5000);
        } else {
          setError('Failed to get test status - backend may be disconnected');
        }
      }
    };
    
    poll();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'QUEUED': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'RUNNING': return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'COMPLETED': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'FAILED': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen p-6">
      <div className="flex items-center gap-4 bg-white rounded-xl shadow-lg p-6 border border-slate-200">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
          <Eye className="w-8 h-8 text-white" />
        </div>
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Visual Testing</h2>
          <p className="text-slate-600 mt-1">AI-powered visual regression testing platform</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'} shadow-lg`}></div>
          <span className={`text-sm font-medium ${isConnected ? 'text-green-700' : 'text-red-700'}`}>
            {isConnected ? '🟢 Backend Connected' : '🔴 Backend Disconnected'}
          </span>
        </div>
      </div>

      {error && (
        <div className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {success && (
        <div className="flex gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>{success}</div>
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-500 hover:text-green-700">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Projects */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Folder className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Projects</h3>
            </div>
            <button
              onClick={() => setShowCreateProject(true)}
              className="p-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProject(project)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedProject?.id === project.id
                    ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-purple-50 shadow-md'
                    : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="font-semibold text-slate-900">{project.name}</div>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-slate-100 px-2 py-1 rounded-full">{project.config.diffThreshold}%</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${project.config.aiEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {project.config.aiEnabled ? '🤖 AI' : '📊 Basic'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Baselines */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Upload className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Baselines</h3>
            </div>
            <button
              onClick={() => setShowCreateBaseline(true)}
              className="p-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {baselines.map((baseline) => (
              <div key={baseline.id} className="p-4 border border-slate-200 rounded-xl hover:border-green-300 hover:shadow-md transition-all duration-200">
                <div className="font-semibold text-slate-900">{baseline.name}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-slate-600">
                    📐 {baseline.metadata.viewport.width}x{baseline.metadata.viewport.height}
                  </div>
                  <Eye 
                    className="w-4 h-4 text-green-600 cursor-pointer hover:text-green-800 transition-colors"
                    onClick={() => {
                      setSelectedBaselineId(baseline.id);
                      setShowBaselineImage(true);
                    }}
                  />
                </div>
                {baseline.tags && baseline.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {baseline.tags.map((tag, index) => (
                      <span key={index} className="text-xs bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 px-2 py-1 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Run AI Visual Test */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Bot className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">AI Visual Test</h3>
            </div>
            <button
              onClick={() => {
                console.log('AI Visual Test button clicked');
                setShowRunTest(true);
              }}
              className="p-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Play className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {testRuns.map((testRun) => (
              <div key={testRun.id} className="p-4 border border-slate-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all duration-200">
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(testRun.status)}
                  <span className={`font-semibold text-sm px-2 py-1 rounded-full ${
                    testRun.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    testRun.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                    testRun.status === 'RUNNING' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {testRun.status}
                  </span>
                </div>
                <div className="text-xs text-slate-600 truncate">{testRun.config.url}</div>
                {testRun.diffResult && (
                  <div className="mt-3 p-2 bg-slate-50 rounded-lg">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      testRun.diffResult.isDifferent ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {testRun.diffResult.isDifferent ? '❌ Different' : '✅ Same'}
                    </span>
                    <div className="mt-1 text-xs text-slate-600">
                      📊 Pixel: {testRun.diffResult.pixelAnalysis.similarityScore.toFixed(2)}% similar
                    </div>
                    <div className="text-xs text-slate-500">
                      🤖 AI Confidence: {testRun.diffResult.confidence.toFixed(1)}%
                    </div>
                    {testRun.diffResult && (
                      <div className="mt-2 flex gap-1">
                        {testRun.diffResult.aiExplanation && (
                          <button
                            onClick={() => {
                              setSelectedAiExplanation(testRun.diffResult!.aiExplanation);
                              setShowAiAnalysis(true);
                            }}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                          >
                            🤖 View AI Analysis
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const diffImageUrl = `http://localhost:3000/api/screenshots/diffs/${testRun.projectId}_${testRun.id}_diff.png`;
                            setSelectedDiffImage(diffImageUrl);
                            setShowDiffImage(true);
                          }}
                          className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition-colors"
                        >
                          🖼️ View Diff
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {testRuns.length === 0 && (
              <div className="text-xs text-slate-500 p-4 bg-gradient-to-r from-slate-50 to-purple-50 rounded-xl border-2 border-dashed border-slate-200">
                🤖 AI visual test results will appear here
              </div>
            )}
          </div>
        </div>

        {/* Run Pixel Compare Test */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Search className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="font-bold text-slate-900 text-lg">Pixel Compare</h3>
            </div>
            <button
              onClick={() => setShowPixelCompare(true)}
              className="p-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Zap className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {pixelResults.map((result) => (
              <div key={result.id} className="p-4 border border-slate-200 rounded-xl hover:border-orange-300 hover:shadow-md transition-all duration-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-slate-900">{result.baseline?.name || 'Pixel Test'}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    result.isDifferent ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {result.isDifferent ? '❌ Different' : '✅ Same'}
                  </span>
                </div>
                <div className="text-xs text-slate-600">
                  📊 {result.similarityScore.toFixed(2)}% similar
                </div>
                <div className="text-xs text-slate-500">
                  🔍 {result.diffPixels} pixels differ ({result.mismatchPercentage.toFixed(2)}%)
                </div>
                {result.diffImage && (
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        setSelectedDiffImage(result.diffImage);
                        setShowDiffImage(true);
                      }}
                      className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition-colors"
                    >
                      🖼️ View Diff
                    </button>
                  </div>
                )}
              </div>
            ))}
            {pixelResults.length === 0 && (
              <div className="text-xs text-slate-500 p-4 bg-gradient-to-r from-slate-50 to-orange-50 rounded-xl border-2 border-dashed border-slate-200">
                🎯 Pixel comparison results will appear here
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input name="name" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Base URL</label>
                <input name="baseUrl" type="url" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Diff Threshold (%)</label>
                <input name="diffThreshold" type="number" defaultValue="95" min="0" max="100" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="flex items-center">
                <input name="aiEnabled" type="checkbox" defaultChecked className="mr-2" />
                <label className="text-sm text-slate-700">Enable AI Analysis</label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                  Create
                </button>
                <button type="button" onClick={() => setShowCreateProject(false)} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Baseline Modal */}
      {showCreateBaseline && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create Baseline</h3>
              <form onSubmit={handleCreateBaseline} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                <select name="projectId" required className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="">Select project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id} selected={selectedProject?.id === project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input name="name" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
                <input name="url" type="url" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Width</label>
                  <input name="width" type="number" defaultValue="1500" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Height</label>
                  <input name="height" type="number" defaultValue="1280" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Image (optional)</label>
                <input name="image" type="file" accept="image/*" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
                <input name="tags" placeholder="homepage, desktop" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              
              {/* Advanced Settings for Baseline */}
              <div className="border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setBaselineShowAdvancedSettings(!baselineShowAdvancedSettings)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all duration-200"
                >
                  <span className="text-sm font-medium text-slate-700">Advanced Settings</span>
                  <div className={`transform transition-transform duration-200 ${baselineShowAdvancedSettings ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {baselineShowAdvancedSettings && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center p-2 bg-white rounded border">
                      <input
                        type="checkbox"
                        id="baselineDisableAnimations"
                        checked={baselineDisableAnimations}
                        onChange={(e) => setBaselineDisableAnimations(e.target.checked)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor="baselineDisableAnimations" className="ml-2 text-sm text-slate-700">
                        Disable animations
                      </label>
                    </div>
                    <div className="flex items-center p-2 bg-white rounded border">
                      <input
                        type="checkbox"
                        id="baselineBlockAds"
                        checked={baselineBlockAds}
                        onChange={(e) => setBaselineBlockAds(e.target.checked)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor="baselineBlockAds" className="ml-2 text-sm text-slate-700">
                        Block ads & tracking
                      </label>
                    </div>
                    <div className="flex items-center p-2 bg-white rounded border">
                      <input
                        type="checkbox"
                        id="baselineScrollToTriggerLazyLoad"
                        checked={baselineScrollToTriggerLazyLoad}
                        onChange={(e) => setBaselineScrollToTriggerLazyLoad(e.target.checked)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor="baselineScrollToTriggerLazyLoad" className="ml-2 text-sm text-slate-700">
                        Trigger lazy loading
                      </label>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Mask Selectors</label>
                      <input
                        type="text"
                        value={baselineMaskSelectors}
                        onChange={(e) => setBaselineMaskSelectors(e.target.value)}
                        placeholder=".ad-banner, .carousel, #dynamic-content"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-1">CSS selectors to mask during capture</p>
                    </div>
                  </div>
                )}
              </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                    Create
                  </button>
                  <button type="button" onClick={() => setShowCreateBaseline(false)} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Run Test Modal */}
      {showRunTest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto m-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Run Visual Test</h3>
              <button
                onClick={() => { setShowRunTest(false); resetDynamicContentState(); }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleRunTest} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <span className="flex items-center">
                    <Eye className="w-4 h-4 mr-2 text-blue-600" />
                    Project
                  </span>
                </label>
                <select
                  name="projectId"
                  required
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 hover:bg-white"
                >
                  <option value="">Select project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id} selected={selectedProject?.id === project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <span className="flex items-center">
                    <Upload className="w-4 h-4 mr-2 text-green-600" />
                    Baseline (optional)
                  </span>
                </label>
                <select
                  name="baselineId"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 hover:bg-white"
                >
                  <option value="">Select baseline...</option>
                  {allBaselines.map((baseline) => (
                    <option key={baseline.id} value={baseline.id}>
                      {baseline.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  <span className="flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-purple-600" />
                    Test URL
                  </span>
                </label>
                <input
                  name="url"
                  type="url"
                  required
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 hover:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Viewport Width</label>
                  <input
                    name="width"
                    type="number"
                    defaultValue="1500"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 hover:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Viewport Height</label>
                  <input
                    name="height"
                    type="number"
                    defaultValue="1280"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 hover:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Priority</label>
                <select
                  name="priority"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 hover:bg-white"
                >
                  <option value="NORMAL">🟡 Normal</option>
                  <option value="HIGH">🔴 High</option>
                  <option value="LOW">🟢 Low</option>
                </select>
              </div>
              
              {/* Advanced Settings */}
              <div className="border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-all duration-200"
                >
                  <span className="text-sm font-medium text-slate-700">Advanced Settings</span>
                  <div className={`transform transition-transform duration-200 ${showAdvancedSettings ? 'rotate-180' : ''}`}>
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                
                {showAdvancedSettings && (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center p-2 bg-white rounded border">
                      <input
                        type="checkbox"
                        id="disableAnimations"
                        checked={disableAnimations}
                        onChange={(e) => setDisableAnimations(e.target.checked)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor="disableAnimations" className="ml-2 text-sm text-slate-700">
                        Disable animations
                      </label>
                    </div>
                    <div className="flex items-center p-2 bg-white rounded border">
                      <input
                        type="checkbox"
                        id="blockAds"
                        checked={blockAds}
                        onChange={(e) => setBlockAds(e.target.checked)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor="blockAds" className="ml-2 text-sm text-slate-700">
                        Block ads & tracking
                      </label>
                    </div>
                    <div className="flex items-center p-2 bg-white rounded border">
                      <input
                        type="checkbox"
                        id="scrollToTriggerLazyLoad"
                        checked={scrollToTriggerLazyLoad}
                        onChange={(e) => setScrollToTriggerLazyLoad(e.target.checked)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor="scrollToTriggerLazyLoad" className="ml-2 text-sm text-slate-700">
                        Trigger lazy loading
                      </label>
                    </div>
                    <div className="flex items-center p-2 bg-white rounded border">
                      <input
                        type="checkbox"
                        id="multipleScreenshots"
                        checked={multipleScreenshots}
                        onChange={(e) => setMultipleScreenshots(e.target.checked)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor="multipleScreenshots" className="ml-2 text-sm text-slate-700">
                        Multiple screenshots
                      </label>
                    </div>
                    <div className="flex items-center p-2 bg-white rounded border">
                      <input
                        type="checkbox"
                        id="stabilityCheck"
                        checked={stabilityCheck}
                        onChange={(e) => setStabilityCheck(e.target.checked)}
                        className="h-4 w-4 text-blue-600"
                      />
                      <label htmlFor="stabilityCheck" className="ml-2 text-sm text-slate-700">
                        Page stability check
                      </label>
                    </div>
                    <div className="p-2 bg-white rounded border">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Mask Selectors</label>
                      <input
                        type="text"
                        value={maskSelectors}
                        onChange={(e) => setMaskSelectors(e.target.value)}
                        placeholder=".ad-banner, .carousel, #dynamic-content"
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-1">CSS selectors to mask during capture</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button 
                  type="submit" 
                  disabled={runTestLoading}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {runTestLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin mr-2" />
                      Running...
                    </>
                  ) : (
                    'Run Test'
                  )}
                </button>
                <button type="button" onClick={() => { setShowRunTest(false); resetDynamicContentState(); }} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pixel Compare Modal */}
      {showPixelCompare && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Pixel Comparison</h3>
            <form onSubmit={handlePixelCompare} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project</label>
                <select name="projectId" required className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="">Select project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id} selected={selectedProject?.id === project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Baseline</label>
                <select name="baselineId" required className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                  <option value="">Select baseline...</option>
                  {allBaselines.map((baseline) => (
                    <option key={baseline.id} value={baseline.id}>
                      {baseline.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL to Compare</label>
                <input name="url" type="url" required className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Width</label>
                  <input name="width" type="number" defaultValue="1500" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Height</label>
                  <input name="height" type="number" defaultValue="1280" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Threshold (0-1)</label>
                <input name="threshold" type="number" step="0.01" defaultValue="5" className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div className="flex gap-2">
                <button 
                  type="submit" 
                  disabled={pixelCompareLoading}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {pixelCompareLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin mr-2" />
                      Comparing...
                    </>
                  ) : (
                    'Compare'
                  )}
                </button>
                <button type="button" onClick={() => setShowPixelCompare(false)} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Analysis Modal */}
      {showAiAnalysis && selectedAiExplanation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                🤖 AI Visual Analysis
              </h3>
              <button
                onClick={() => setShowAiAnalysis(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">Summary</h4>
                <p className="text-blue-700">{selectedAiExplanation.summary}</p>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-800 mb-2">Details</h4>
                <p className="text-slate-700">{selectedAiExplanation.details}</p>
              </div>
              
              {selectedAiExplanation.recommendations && selectedAiExplanation.recommendations.length > 0 && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">Recommendations</h4>
                  <ul className="list-disc list-inside space-y-1 text-green-700">
                    {selectedAiExplanation.recommendations.map((rec: string, idx: number) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-2">Severity</h4>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedAiExplanation.severity === 'high' ? 'bg-red-100 text-red-800' :
                  selectedAiExplanation.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {selectedAiExplanation.severity.toUpperCase()}
                </span>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowAiAnalysis(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Baseline Image Modal */}
      {showBaselineImage && selectedBaselineId && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 max-w-[90vw] max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Baseline Image</h3>
              <button
                onClick={() => setShowBaselineImage(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            <div className="flex justify-center">
              <img 
                src={`http://localhost:3000/api/baselines/${selectedBaselineId}/image`}
                alt="Baseline Image" 
                className="max-w-full max-h-[70vh] object-contain border border-slate-200 rounded"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBhdmFpbGFibGU8L3RleHQ+PC9zdmc+';
                }}
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowBaselineImage(false)}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff Image Modal */}
      {showDiffImage && selectedDiffImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 max-w-[90vw] max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-900">🖼️ Visual Diff Comparison</h3>
              <button
                onClick={() => setShowDiffImage(false)}
                className="text-gray-500 hover:text-gray-700 text-xl"
              >
                ×
              </button>
            </div>
            <div className="flex justify-center">
              <img 
                src={selectedDiffImage} 
                alt="Visual Diff" 
                className="max-w-full max-h-[70vh] object-contain border border-slate-200 rounded"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowDiffImage(false)}
                className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-6 shadow-lg">
        <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
          💡 <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">How it works</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Create projects to organize your visual tests
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Upload baselines or capture them from URLs
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Run tests to compare current state with baselines
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              Use Pixel Compare for fast pixel-only comparisons
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
              AI analyzes differences and provides explanations
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              Backend runs on port 3000 - ensure it's started
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}