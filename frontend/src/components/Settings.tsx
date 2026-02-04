import { useState, useEffect } from 'react';
import { Figma, Settings2, ExternalLink, Loader, CheckCircle } from 'lucide-react';
import { LLMSettings } from './LLMSettings';
import { connectJira, connectServiceNow } from '../services/integrationService';
import { getIntegrationConfigFromEnv } from '../config/integrationConfig';

// Get API base URL from environment, defaults to localhost:8080
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

interface Integration {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isConnected: boolean;
  isConnecting: boolean;
  endpoint?: string;
  username?: string;
  apiKey?: string;
  password?: string;
  docLink?: string;
  testResult?: { success: boolean; message: string };
}

export function Settings() {
  const [selectedTab, setSelectedTab] = useState<'llm' | 'other'>('llm');

  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'jira',
      title: 'Jira Integration',
      description: 'Sync with Jira for issue tracking and project management',
      icon: <Figma className="w-8 h-8" />,
      isConnected: false,
      isConnecting: false,
      endpoint: '',
      username: '',
      apiKey: '',
      docLink: 'https://developer.atlassian.com/cloud/jira/rest/v3/',
    },
    {
      id: 'servicenow',
      title: 'ServiceNow Integration',
      description: 'Connect to ServiceNow for incident and change management',
      icon: <Settings2 className="w-8 h-8" />,
      isConnected: false,
      isConnecting: false,
      endpoint: '',
      username: '',
      password: '',
      docLink: 'https://developer.servicenow.com/dev_portal_landing.do',
    },
  ]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempConfig, setTempConfig] = useState<Partial<Integration>>({});

  // Load integration configurations from environment variables and backend status on mount
  useEffect(() => {
    const loadIntegrationStatus = async () => {
      const envConfig = getIntegrationConfigFromEnv();
      
      // Fetch actual connection status from backend
      try {
        const configResponse = await fetch(`${API_BASE_URL}/api/config`);
        if (configResponse.ok) {
          const config = await configResponse.json();
          
          setIntegrations((prevIntegrations) =>
            prevIntegrations.map((integration) => {
              if (integration.id === 'jira') {
                return {
                  ...integration,
                  endpoint: envConfig.jira?.endpoint || integration.endpoint,
                  username: envConfig.jira?.username || integration.username,
                  apiKey: envConfig.jira?.apiKey || integration.apiKey,
                  isConnected: config.integrations?.jiraConfigured || false,
                };
              }
              if (integration.id === 'servicenow') {
                return {
                  ...integration,
                  endpoint: envConfig.servicenow?.endpoint || integration.endpoint,
                  username: envConfig.servicenow?.username || integration.username,
                  password: envConfig.servicenow?.password || integration.password,
                  isConnected: config.integrations?.serviceNowConfigured || false,
                };
              }
              return integration;
            })
          );
        }
      } catch (error) {
        console.warn('[Settings] Failed to fetch integration status:', error);
        // Fallback to env config only
        if (envConfig.jira || envConfig.servicenow) {
          setIntegrations((prevIntegrations) =>
            prevIntegrations.map((integration) => {
              if (integration.id === 'jira' && envConfig.jira) {
                return {
                  ...integration,
                  endpoint: envConfig.jira.endpoint,
                  username: envConfig.jira.username,
                  apiKey: envConfig.jira.apiKey,
                };
              }
              if (integration.id === 'servicenow' && envConfig.servicenow) {
                return {
                  ...integration,
                  endpoint: envConfig.servicenow.endpoint,
                  username: envConfig.servicenow.username,
                  password: envConfig.servicenow.password,
                };
              }
              return integration;
            })
          );
        }
      }
    };
    
    loadIntegrationStatus();
  }, []);

  useEffect(() => {
    const serviceNowIntegration = integrations.find((i) => i.id === 'servicenow');
    if (serviceNowIntegration?.isConnected) {
      localStorage.setItem('servicenow_config', JSON.stringify({
        endpoint: serviceNowIntegration.endpoint,
        username: serviceNowIntegration.username,
        isConnected: true,
      }));
    } else {
      localStorage.removeItem('servicenow_config');
    }
  }, [integrations]);

  const handleEdit = (id: string) => {
    const integration = integrations.find((i) => i.id === id);
    if (integration) {
      setTempConfig({ ...integration });
    }
    setEditingId(id);
  };

  const handleConnect = async (id: string) => {
    const integration = integrations.find((i) => i.id === id);
    if (!integration) return;

    if (id === 'jira') {
      if (!integration.endpoint?.trim() || !integration.username?.trim() || !integration.apiKey?.trim()) {
        alert('Please fill in all required fields for Jira');
        return;
      }
    } else if (id === 'servicenow') {
      if (!integration.endpoint?.trim() || !integration.username?.trim() || !integration.password?.trim()) {
        alert('Please fill in all required fields for ServiceNow');
        return;
      }
    }

    setIntegrations(
      integrations.map((i) =>
        i.id === id ? { ...i, isConnecting: true } : i
      )
    );

    try {
      let testResult: { success: boolean; message: string } | undefined;
      if (id === 'jira') {
        const result = await connectJira(
          integration.endpoint || '',
          integration.username || '',
          integration.apiKey || ''
        );
        testResult = { success: result.success, message: result.message };
      } else if (id === 'servicenow') {
        const result = await connectServiceNow(
          integration.endpoint || '',
          integration.username || '',
          integration.password || ''
        );
        testResult = { success: result.success, message: result.message };
      }

      if (testResult) {
        setIntegrations(
          integrations.map((i) =>
            i.id === id
              ? {
                  ...i,
                  isConnecting: false,
                  isConnected: testResult.success,
                  testResult,
                }
              : i
          )
        );

        if (!testResult.success) {
          alert(testResult.message);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setIntegrations(
        integrations.map((i) =>
          i.id === id
            ? {
                ...i,
                isConnecting: false,
                isConnected: false,
                testResult: { success: false, message: errorMessage },
              }
            : i
        )
      );
      alert(`Connection error: ${errorMessage}`);
    }
  };

  const handleSave = (id: string) => {
    if (id === 'jira') {
      if (!tempConfig.endpoint?.trim() || !tempConfig.username?.trim() || !tempConfig.apiKey?.trim()) {
        alert('Please fill in all required fields for Jira');
        return;
      }
    } else if (id === 'servicenow') {
      if (!tempConfig.endpoint?.trim() || !tempConfig.username?.trim() || !tempConfig.password?.trim()) {
        alert('Please fill in all required fields for ServiceNow');
        return;
      }
    }

    setIntegrations(
      integrations.map((i) =>
        i.id === id
          ? {
              ...i,
              ...tempConfig,
            }
          : i
      )
    );
    setEditingId(null);
  };

  const handleDisconnect = (id: string) => {
    setIntegrations(
      integrations.map((i) =>
        i.id === id
          ? {
              ...i,
              isConnected: false,
              isConnecting: false,
              testResult: undefined,
            }
          : i
      )
    );
    setEditingId(null);
  };

  const updateTempConfig = (field: string, value: string) => {
    setTempConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (selectedTab === 'llm') {
    return (
      <div className="space-y-6">
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setSelectedTab('llm')}
            className="px-4 py-2 font-semibold text-blue-600 border-b-2 border-blue-600"
          >
            LLM Integration
          </button>
          <button
            onClick={() => setSelectedTab('other')}
            className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
          >
            Other Integrations
          </button>
        </div>
        <LLMSettings />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setSelectedTab('llm')}
          className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900"
        >
          LLM Integration
        </button>
        <button
          onClick={() => setSelectedTab('other')}
          className="px-4 py-2 font-semibold text-blue-600 border-b-2 border-blue-600"
        >
          Other Integrations
        </button>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Other Integrations</h3>
        <p className="text-slate-600">Configure and manage your external service integrations. Credentials are securely stored in your session.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="text-blue-600 bg-blue-50 p-3 rounded-lg">
                  {integration.icon}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">{integration.title}</h4>
                  <p className="text-sm text-slate-600 mt-1">{integration.description}</p>
                </div>
              </div>
            </div>

            {editingId === integration.id ? (
              <div className="space-y-4 border-t border-slate-200 pt-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    {integration.id === 'jira' ? 'Jira Instance URL' : 'ServiceNow Instance URL'}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tempConfig.endpoint || ''}
                    onChange={(e) => updateTempConfig('endpoint', e.target.value)}
                    placeholder={
                      integration.id === 'jira'
                        ? 'https://your-domain.atlassian.net'
                        : 'https://your-instance.service-now.com'
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Username / Email
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={tempConfig.username || ''}
                    onChange={(e) => updateTempConfig('username', e.target.value)}
                    placeholder="your-username@email.com"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {integration.id === 'jira' ? (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      API Token
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={tempConfig.apiKey || ''}
                      onChange={(e) => updateTempConfig('apiKey', e.target.value)}
                      placeholder="Enter your Jira API token"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Get your API token from{' '}
                      <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Atlassian API Tokens
                      </a>
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Password
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={tempConfig.password || ''}
                      onChange={(e) => updateTempConfig('password', e.target.value)}
                      placeholder="Enter your ServiceNow password"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => handleSave(integration.id)}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 bg-slate-300 text-slate-700 py-2 rounded-lg hover:bg-slate-400 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                {integration.endpoint && (
                  <div className="text-sm space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div>
                      <span className="font-semibold text-slate-700">URL:</span>
                      <p className="text-slate-600 break-all text-xs">{integration.endpoint}</p>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">Username:</span>
                      <p className="text-slate-600">{integration.username}</p>
                    </div>
                    {integration.id === 'jira' && integration.apiKey && (
                      <div>
                        <span className="font-semibold text-slate-700">API Key:</span>
                        <p className="text-slate-600">{'•'.repeat(20)}</p>
                      </div>
                    )}
                    {integration.id === 'servicenow' && integration.password && (
                      <div>
                        <span className="font-semibold text-slate-700">Password:</span>
                        <p className="text-slate-600">{'•'.repeat(20)}</p>
                      </div>
                    )}
                  </div>
                )}

                {integration.testResult && (
                  <div className={`flex gap-2 p-3 rounded-lg border text-sm ${
                    integration.testResult.success
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${integration.testResult.success ? 'text-green-600' : 'text-red-600'}`} />
                    <div>{integration.testResult.message}</div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {integration.isConnecting && <Loader className="w-5 h-5 text-blue-600 animate-spin" />}
                  {integration.isConnected && !integration.isConnecting && (
                    <>
                      <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                      <span className="text-sm font-semibold text-green-700">Connected</span>
                    </>
                  )}
                  {!integration.isConnected && !integration.isConnecting && (
                    <>
                      <span className="w-3 h-3 bg-slate-400 rounded-full"></span>
                      <span className="text-sm font-semibold text-slate-600">Not Connected</span>
                    </>
                  )}
                </div>

                <div className="flex gap-3 flex-wrap">
                  {integration.isConnected ? (
                    <>
                      <button
                        onClick={() => handleEdit(integration.id)}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-semibold text-sm"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => handleDisconnect(integration.id)}
                        className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-semibold text-sm"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(integration.id)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
                      >
                        Configure
                      </button>
                      {integration.endpoint && integration.username && (
                        <button
                          onClick={() => handleConnect(integration.id)}
                          disabled={integration.isConnecting}
                          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                        >
                          {integration.isConnecting ? (
                            <>
                              <Loader className="w-4 h-4 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            'Connect'
                          )}
                        </button>
                      )}
                    </>
                  )}

                  {integration.docLink && (
                    <a
                      href={integration.docLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-semibold text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Docs
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-8">
        <h4 className="font-semibold text-slate-900 mb-2">How It Works</h4>
        <ul className="text-sm text-slate-700 space-y-2">
          <li>
            <strong>Jira:</strong> Enter your Jira instance URL, email, and API token. Click "Connect" to establish a secure session-based connection.
          </li>
          <li>
            <strong>ServiceNow:</strong> Enter your ServiceNow instance URL, username, and password. Click "Connect" to establish a secure session-based connection.
          </li>
          <li>
            <strong>Secure Session Storage:</strong> Your credentials are validated once and stored securely in your session (not in the browser or .env). No repeated prompts!
          </li>
          <li>
            <strong>Test Cases Generator:</strong> Once connected, you can select stories from Jira or ServiceNow and generate test cases using AI.
          </li>
        </ul>
      </div>
    </div>
  );
}
