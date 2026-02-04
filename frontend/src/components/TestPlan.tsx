import { useState } from 'react';
import { CheckCircle, Circle, AlertCircle, Loader } from 'lucide-react';

interface Story {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'pending';
  assignee: string;
  priority: 'high' | 'medium' | 'low';
}

interface TestPlanResult {
  systemTesting: string[];
  systemIntegrationTesting: string[];
  regressionTesting: string[];
}

const mockStories: Story[] = [
  {
    id: 'STORY-001',
    title: 'User Authentication Module',
    description: 'Implement login and registration functionality',
    status: 'completed',
    assignee: 'John Doe',
    priority: 'high',
  },
  {
    id: 'STORY-002',
    title: 'Dashboard Analytics',
    description: 'Create dashboard with analytics charts and metrics',
    status: 'in-progress',
    assignee: 'Jane Smith',
    priority: 'high',
  },
  {
    id: 'STORY-003',
    title: 'API Integration',
    description: 'Integrate third-party API for data processing',
    status: 'in-progress',
    assignee: 'Mike Johnson',
    priority: 'medium',
  },
  {
    id: 'STORY-004',
    title: 'Report Generation',
    description: 'Generate PDF reports with data export functionality',
    status: 'pending',
    assignee: 'Sarah Williams',
    priority: 'medium',
  },
  {
    id: 'STORY-005',
    title: 'Mobile Responsive Design',
    description: 'Ensure all components are mobile responsive',
    status: 'pending',
    assignee: 'Tom Brown',
    priority: 'low',
  },
  {
    id: 'STORY-006',
    title: 'Performance Optimization',
    description: 'Optimize page load time and reduce bundle size',
    status: 'completed',
    assignee: 'Emma Davis',
    priority: 'medium',
  },
];

const getStatusIcon = (status: Story['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    case 'in-progress':
      return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    case 'pending':
      return <Circle className="w-5 h-5 text-gray-400" />;
  }
};

const getStatusColor = (status: Story['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-green-50 border-green-200';
    case 'in-progress':
      return 'bg-yellow-50 border-yellow-200';
    case 'pending':
      return 'bg-gray-50 border-gray-200';
  }
};

const getPriorityBadge = (priority: Story['priority']) => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800';
    case 'medium':
      return 'bg-orange-100 text-orange-800';
    case 'low':
      return 'bg-blue-100 text-blue-800';
  }
};

export function TestPlan() {
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [testPlanResult, setTestPlanResult] = useState<TestPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckboxChange = (storyId: string) => {
    const newSelected = new Set(selectedStories);
    if (newSelected.has(storyId)) {
      newSelected.delete(storyId);
    } else {
      newSelected.add(storyId);
    }
    setSelectedStories(newSelected);
  };

  const generateTestPlan = async () => {
    if (selectedStories.size === 0) {
      setError('Please select at least one story');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setTestPlanResult(null);

      const { llmService } = await import('../services/llmService');
      const configuredProviders = llmService.getConfiguredProviders();

      if (configuredProviders.length === 0) {
        setError('No LLM providers configured. Please configure at least one provider in Settings.');
        setIsLoading(false);
        return;
      }

      const provider = configuredProviders[0];
      const config = llmService.getConfig(provider);

      if (!config) {
        setError(`Provider ${provider} is not properly configured`);
        setIsLoading(false);
        return;
      }

      const selectedStoriesList = Array.from(selectedStories)
        .map((id) => mockStories.find((s) => s.id === id))
        .filter(Boolean) as Story[];

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${apiBaseUrl}/api/test-plan/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stories: selectedStoriesList,
          provider,
          model: config.model,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setTestPlanResult(data as TestPlanResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate test plan';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Test Plan & Stories</h3>
        <p className="text-slate-600">Manage and track all user stories and test requirements</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {mockStories.map((story) => (
          <div
            key={story.id}
            className={`p-5 rounded-lg border-2 transition-all hover:shadow-md ${getStatusColor(story.status)}`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={selectedStories.has(story.id)}
                  onChange={() => handleCheckboxChange(story.id)}
                  className="w-5 h-5 rounded cursor-pointer"
                  aria-label={`Select ${story.id}`}
                />
              </div>
              
              <div className="flex-shrink-0 mt-1">{getStatusIcon(story.status)}</div>
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-semibold text-slate-700">{story.id}</span>
                  <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${getPriorityBadge(story.priority)}`}>
                    {story.priority.charAt(0).toUpperCase() + story.priority.slice(1)}
                  </span>
                  <span className="text-xs font-medium text-slate-600 capitalize">
                    {story.status.replace('-', ' ')}
                  </span>
                </div>
                
                <h4 className="text-base font-semibold text-slate-900 mb-1">{story.title}</h4>
                <p className="text-sm text-slate-600 mb-3">{story.description}</p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Assigned to: <span className="font-medium text-slate-700">{story.assignee}</span></span>
                </div>
              </div>

              <button className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {selectedStories.size > 0 && (
        <div className="flex justify-end">
          <button
            onClick={generateTestPlan}
            disabled={isLoading}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading && <Loader className="w-5 h-5 animate-spin" />}
            Generate QA Test Plan
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-700 text-sm mt-1">{error}</p>
        </div>
      )}

      {testPlanResult && (
        <div className="bg-white rounded-lg border-2 border-blue-200 p-6 space-y-6">
          <h3 className="text-2xl font-bold text-slate-900">Generated QA Test Plan</h3>
          
          <div>
            <h4 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
              System Testing
            </h4>
            <ul className="space-y-2">
              {testPlanResult.systemTesting.map((test, idx) => (
                <li key={idx} className="text-slate-700 flex gap-3">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>{test}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-600 rounded-full"></span>
              System Integration Testing
            </h4>
            <ul className="space-y-2">
              {testPlanResult.systemIntegrationTesting.map((test, idx) => (
                <li key={idx} className="text-slate-700 flex gap-3">
                  <span className="text-purple-600 font-bold">•</span>
                  <span>{test}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-600 rounded-full"></span>
              Regression Testing
            </h4>
            <ul className="space-y-2">
              {testPlanResult.regressionTesting.map((test, idx) => (
                <li key={idx} className="text-slate-700 flex gap-3">
                  <span className="text-orange-600 font-bold">•</span>
                  <span>{test}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
