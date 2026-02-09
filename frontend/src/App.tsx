import { useState, useEffect } from 'react';
import {
  FileText,
  TestTubes,
  Wand2,
  Menu,
  X,
  Settings as SettingsIcon,
  ClipboardList,
  Workflow,
  ChevronRight,
  Home,
  Moon,
  Sun,
  Shield,
} from 'lucide-react';
import { RequirementAnalysis } from './components/RequirementAnalysis';
import { Settings } from './components/Settings';
import { TestCases } from './components/TestCases';
import { TestCasesGeneratorTabs } from './components/TestCasesGeneratorTabs';
import { SwaggerAPI } from './components/SwaggerAPI';
import { VisualTesting } from './components/VisualTesting';
import { TestPlan } from './components/TestPlan';
import { StatusBadge } from './components/StatusBadge';
import { EpicStoryExtraction } from './components/EpicStoryExtraction';
import { piiConfigService } from './services/piiConfigService';
import { PIIConfig } from './config/piiConfig';

// Get API base URL from environment, defaults to localhost:8080
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
import { llmService } from './services/llmService';
import { LLM_PROVIDERS, type LLMProvider } from './config/llmConfig';
import { getDefaultLLMConfig } from './config/llmConfig';
import { getIntegrationConfigFromEnv } from './config/integrationConfig';
import { connectJira, connectServiceNow } from './services/integrationService';

interface MenuItem {
  id: number;
  title: string;
  icon: React.ReactNode;
}

const menuItems: MenuItem[] = [
  {
    id: 7,
    title: 'Epic & Story Extraction',
    icon: <Workflow className="w-5 h-5" />,
  },
  {
    id: 1,
    title: 'Requirement Analysis',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: 2,
    title: 'Test Cases Generator',
    icon: <TestTubes className="w-5 h-5" />,
  },
  /*{
    id: 3,
    title: 'Swagger - API Testcase Generator',
    icon: <Database className="w-5 h-5" />,
  },
  {
    id: 4,
    title: 'Visual Testing',
    icon: <Eye className="w-5 h-5" />,
  },*/
  {
    id: 5,
    title: 'Generate No Code',
    icon: <Wand2 className="w-5 h-5" />,
  },
  {
    id: 6,
    title: 'Test Plan',
    icon: <ClipboardList className="w-5 h-5" />,
  },
  
 /* {
    id: 4,
    title: 'Test Data Generator',
    icon: <Zap className="w-5 h-5" />,
  },
  {
    id: 5,
    title: 'Regression Testing Identification',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    id: 6,
    title: 'Chat Bot',
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    id: 7,
    title: 'QA Dashboard',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    id: 8,
    title: 'Data Testing',
    icon: <CheckSquare className="w-5 h-5" />,
  },
  {
    id: 9,
    title: 'Visual Testing',
    icon: <Eye className="w-5 h-5" />,
  },
  {
    id: 10,
    title: 'Generate No Code',
    icon: <Wand2 className="w-5 h-5" />,
  },
  {
    id: 11,
    title: 'Code Conversion',
    icon: <Code2 className="w-5 h-5" />,
  },
  {
    id: 12,
    title: 'Test Cases',
    icon: <List className="w-5 h-5" />,
  },*/
  {
    id: 13,
    title: 'Settings',
    icon: <SettingsIcon className="w-5 h-5" />,
  },
];

function App() {
  const [selectedMenu, setSelectedMenu] = useState<number>(1);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [llmStatus, setLlmStatus] = useState<{ provider: LLMProvider | null; isConnected: boolean; isLoading: boolean }>({
    provider: null,
    isConnected: false,
    isLoading: false,
  });
  const [defaultIntegration, setDefaultIntegration] = useState<'jira' | 'servicenow' | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState<{ isConnected: boolean; isLoading: boolean }>({
    isConnected: false,
    isLoading: false,
  });
  const [piiConfig, setPiiConfig] = useState<PIIConfig | null>(null);

  // Fetch backend configuration on app startup (single source of truth)
  useEffect(() => {
    const fetchBackendConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/config`);
        if (response.ok) {
          const config = await response.json();
          console.log('[App] Backend config loaded:', config);
          
          // Get default integration from backend
          const defaultIntegrationName = config.integrations?.defaultIntegration || 'jira';
          setDefaultIntegration(defaultIntegrationName);
          
          // Update status based on default integration
          if (defaultIntegrationName === 'jira') {
            setIntegrationStatus({
              isConnected: config.integrations?.jiraConfigured || false,
              isLoading: false,
            });
          } else if (defaultIntegrationName === 'servicenow') {
            setIntegrationStatus({
              isConnected: config.integrations?.serviceNowConfigured || false,
              isLoading: false,
            });
          }
        }
      } catch (error) {
        console.warn('[App] Failed to fetch backend config, using frontend VITE_ fallbacks:', error);
      }
    };
    fetchBackendConfig();
  }, []);

  // Auto-initialize connections from environment on app startup
  useEffect(() => {
    const initializeAutoConnections = async () => {
      console.log('[App] Initializing auto-connections from environment...');

      // Load default LLM provider configuration
      const llmConfig = getDefaultLLMConfig();
      if (llmConfig) {
        try {
          llmService.addConfig(llmConfig.provider, llmConfig);
          console.log(`✅ [App] Default LLM provider '${llmConfig.provider}' loaded`);
        } catch (error) {
          console.warn('[App] Failed to load default LLM config:', error);
        }
      }

      // Auto-connect only the default integration from environment
      const integrationConfig = getIntegrationConfigFromEnv();

      if (defaultIntegration === 'jira' && integrationConfig.jira) {
        try {
          const result = await connectJira(
            integrationConfig.jira.endpoint,
            integrationConfig.jira.username,
            integrationConfig.jira.apiKey
          );
          if (result.success) {
            console.log(`✅ [App] Jira auto-connected: ${result.user}`);
          }
        } catch (error) {
          console.warn('[App] Jira auto-connection failed:', error);
        }
      } else if (defaultIntegration === 'servicenow' && integrationConfig.servicenow) {
        try {
          const result = await connectServiceNow(
            integrationConfig.servicenow.endpoint,
            integrationConfig.servicenow.username,
            integrationConfig.servicenow.password
          );
          if (result.success) {
            console.log(`✅ [App] ServiceNow auto-connected`);
          }
        } catch (error) {
          console.warn('[App] ServiceNow auto-connection failed:', error);
        }
      }
    };

    if (defaultIntegration) {
      initializeAutoConnections();
    }
  }, [defaultIntegration]);

  // Check LLM provider status on component mount and when menu changes
  useEffect(() => {
    const checkStatuses = async () => {
      // Check LLM status
      const configuredProviders = llmService.getConfiguredProviders();
      if (configuredProviders.length > 0) {
        const provider = configuredProviders[0];
        setLlmStatus((prev) => ({ ...prev, provider, isLoading: true }));
        
        const result = await llmService.testConnection(provider);
        setLlmStatus({
          provider,
          isConnected: result.success,
          isLoading: false,
        });
      } else {
        setLlmStatus({ provider: null, isConnected: false, isLoading: false });
      }

      // Check default integration status from backend /api/config
      try {
        const response = await fetch(`${API_BASE_URL}/api/config`);
        if (response.ok) {
          const config = await response.json();
          
          if (config.integrations) {
            const integrationName = config.integrations.defaultIntegration || 'jira';
            
            if (integrationName === 'jira') {
              setIntegrationStatus({
                isConnected: config.integrations.jiraConfigured || false,
                isLoading: false,
              });
            } else if (integrationName === 'servicenow') {
              setIntegrationStatus({
                isConnected: config.integrations.serviceNowConfigured || false,
                isLoading: false,
              });
            }
          }
        }
      } catch (error) {
        console.warn('[App] Failed to fetch integration status:', error);
      }
    };

    checkStatuses();
    
    // Load PII config
    const loadPiiConfig = async () => {
      try {
        const config = await piiConfigService.getConfig();
        setPiiConfig(config);
      } catch (error) {
        console.warn('Failed to load PII config:', error);
      }
    };
    loadPiiConfig();
    
    // Recheck when returning to app (every 30 seconds)
    const interval = setInterval(() => {
      checkStatuses();
      loadPiiConfig();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const selectedItem = menuItems.find((item) => item.id === selectedMenu);

  return (
    <div className={`min-h-screen flex ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } transition-all duration-300 overflow-hidden ${
          darkMode
            ? 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900'
            : 'bg-gradient-to-b from-slate-900 to-slate-800'
        }`}
      >
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-300 via-blue-200 to-purple-300 bg-clip-text text-transparent tracking-wider drop-shadow-lg">R-Automation</h1>
          <p className="text-slate-300 text-sm mt-1 font-semibold tracking-wide">Test Management</p>
        </div>

        <nav className="mt-6 space-y-1 px-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedMenu(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left group ${
                selectedMenu === item.id
                  ? 'bg-teal-600 text-white shadow-md hover:bg-teal-700'
                  : darkMode
                  ? 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <div className="flex-shrink-0">{item.icon}</div>
              <span className="flex-1 text-sm font-medium truncate">{item.title}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 flex flex-col">
        {/* Header with Breadcrumb */}
        <div className={`px-6 py-4 border-b ${
          darkMode
            ? 'bg-slate-900 border-slate-800'
            : 'bg-white border-slate-200'
        }`}>
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setSelectedMenu(1)}
              className={`flex items-center gap-1 transition-colors ${
                darkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Home className="w-4 h-4" />
              <span className="text-sm font-medium">Home</span>
            </button>
            {selectedItem && selectedMenu !== 1 && (
              <>
                <ChevronRight className={`w-4 h-4 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`} />
                <span className={`text-sm font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>{selectedItem.title}</span>
              </>
            )}
          </div>

          {/* Top Bar with Title and Status */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-lg transition-colors ${
                darkMode
                  ? 'hover:bg-slate-800 text-slate-400'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className={`text-2xl font-bold ${darkMode ? 'text-slate-100' : 'text-slate-900'}`}>{selectedItem?.title}</h2>
            <div className="flex items-center gap-3">
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg transition-colors ${
                  darkMode
                    ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700'
                    : 'hover:bg-slate-100 text-slate-600'
                }`}
                title={darkMode ? 'Light mode' : 'Dark mode'}
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              {llmStatus.provider && (
                <StatusBadge
                  provider={LLM_PROVIDERS[llmStatus.provider]?.name || llmStatus.provider}
                  isConnected={llmStatus.isConnected}
                  isLoading={llmStatus.isLoading}
                />
              )}
              {defaultIntegration && integrationStatus.isConnected && (
                <StatusBadge
                  provider={defaultIntegration === 'jira' ? 'Jira' : 'ServiceNow'}
                  isConnected={integrationStatus.isConnected}
                  isLoading={integrationStatus.isLoading}
                />
              )}
              {/* PII Detection Status */}
              {piiConfig && (
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <div className="flex items-center gap-1 text-xs">
                    <span className={`px-2 py-1 rounded-md font-medium ${
                      piiConfig.mode === 'block' 
                        ? 'bg-red-100 text-red-800 border-red-200' 
                        : piiConfig.mode === 'mask'
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        : piiConfig.mode === 'warn'
                        ? 'bg-orange-100 text-orange-800 border-orange-200'
                        : 'bg-gray-100 text-gray-800 border-gray-200'
                    } border`}>
                      {piiConfig.mode.toUpperCase()}
                    </span>
                    <span className={`px-2 py-1 rounded-md font-medium ${
                      piiConfig.sensitivityLevel === 'high'
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : piiConfig.sensitivityLevel === 'medium'
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        : 'bg-green-100 text-green-800 border-green-200'
                    } border`}>
                      {piiConfig.sensitivityLevel.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
              {!llmStatus.provider && (!defaultIntegration || !integrationStatus.isConnected) && (
                <div className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>No integrations configured</div>
              )}
            </div>
          </div>
        </div>

        <div className={`flex-1 p-8 overflow-auto ${darkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <div className="max-w-6xl">
            {selectedMenu === 1 ? (
              <RequirementAnalysis />
            ) : selectedMenu === 2 ? (
              <TestCasesGeneratorTabs />
            ) : selectedMenu === 3 ? (
              <SwaggerAPI />
            ) : selectedMenu === 4 ? (
              <VisualTesting />
            ) : selectedMenu === 6 ? (
              <TestPlan />
            ) : selectedMenu === 7 ? (
              <EpicStoryExtraction />
            ) : selectedMenu === 12 ? (
              <TestCases />
            ) : selectedMenu === 13 ? (
              <Settings />
            ) : (
              <div className="bg-white rounded-xl shadow-md p-12 border border-slate-200">
                <div className="flex justify-center mb-6 text-blue-600">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                    {selectedItem?.icon}
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-slate-900 mb-4 text-center">
                  {selectedItem?.title}
                </h3>
                <p className="text-slate-600 text-lg text-center leading-relaxed">
                  Welcome to the {selectedItem?.title} module. This is where the functionality will be
                  implemented.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
