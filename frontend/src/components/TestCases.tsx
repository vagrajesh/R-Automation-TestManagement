import { useState } from 'react';

interface TestCase {
  id: string;
  testCaseId: string;
  module: string;
  testCaseTitle: string;
  testCaseDescription: string;
  preconditions: string;
  testSteps: string;
  expectedResults: string;
  priority: 'P1' | 'P2' | 'P3';
  testType: 'Integration' | 'Functional';
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  linkedUserStories: string[];
  sourceCitations: string[];
  complianceNotes: string;
  estimatedExecutionTime: string;
}

const mockTestCases: TestCase[] = [
  {
    id: '1',
    testCaseId: 'TC-001',
    module: 'Authentication',
    testCaseTitle: 'User Login with Valid Credentials',
    testCaseDescription: 'Verify that users can successfully login with valid email and password',
    preconditions: 'User account must exist in the system',
    testSteps: '1. Navigate to login page\n2. Enter valid email\n3. Enter valid password\n4. Click Login button\n5. Verify redirect to dashboard',
    expectedResults: 'User is logged in successfully and redirected to dashboard',
    priority: 'P1',
    testType: 'Functional',
    riskLevel: 'Critical',
    linkedUserStories: ['US-001', 'US-002'],
    sourceCitations: ['REQ-AUTH-001'],
    complianceNotes: 'Must comply with OWASP authentication standards',
    estimatedExecutionTime: '5 minutes',
  },
  {
    id: '2',
    testCaseId: 'TC-002',
    module: 'Authentication',
    testCaseTitle: 'User Login with Invalid Credentials',
    testCaseDescription: 'Verify that login fails with invalid credentials',
    preconditions: 'User account must exist in the system',
    testSteps: '1. Navigate to login page\n2. Enter invalid email\n3. Enter invalid password\n4. Click Login button\n5. Verify error message',
    expectedResults: 'Error message is displayed, user is not logged in',
    priority: 'P1',
    testType: 'Functional',
    riskLevel: 'Critical',
    linkedUserStories: ['US-001'],
    sourceCitations: ['REQ-AUTH-002'],
    complianceNotes: 'Must provide security warnings',
    estimatedExecutionTime: '5 minutes',
  },
];

export function TestCases() {
  const [testCases] = useState<TestCase[]>(mockTestCases);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P1': return 'bg-red-100 text-red-700 border-red-300';
      case 'P2': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'P3': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Critical': return 'bg-red-100 text-red-700 border-red-300';
      case 'High': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Low': return 'bg-green-100 text-green-700 border-green-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  if (testCases.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 border border-slate-200 text-center">
        <div className="text-slate-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Test Cases Found</h3>
        <p className="text-slate-600">Generate test cases from the Test Cases Generator module to see them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Test Cases</h3>
          <p className="text-slate-600 mt-1">Total: {testCases.length} test cases</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Test Case ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Module</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Test Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Risk Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Est. Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {testCases.map((testCase) => (
                <tr key={testCase.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-slate-900">{testCase.testCaseId}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{testCase.module}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 font-medium max-w-xs truncate">{testCase.testCaseTitle}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded border ${getPriorityColor(testCase.priority)}`}>
                      {testCase.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{testCase.testType}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-semibold rounded border ${getRiskLevelColor(testCase.riskLevel)}`}>
                      {testCase.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{testCase.estimatedExecutionTime || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedTestCase(testCase)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTestCase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Test Case Details</h3>
              <button
                onClick={() => setSelectedTestCase(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Test Case ID</label>
                  <p className="text-sm font-mono text-slate-900 mt-1">{selectedTestCase.testCaseId}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Module</label>
                  <p className="text-sm text-slate-900 mt-1">{selectedTestCase.module}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Title</label>
                <p className="text-base font-semibold text-slate-900 mt-1">{selectedTestCase.testCaseTitle}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Description</label>
                <p className="text-sm text-slate-700 mt-1 leading-relaxed">{selectedTestCase.testCaseDescription}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Priority</label>
                  <span className={`inline-block px-3 py-1 text-sm font-semibold rounded border mt-2 ${getPriorityColor(selectedTestCase.priority)}`}>
                    {selectedTestCase.priority}
                  </span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Test Type</label>
                  <p className="text-sm text-slate-900 mt-2">{selectedTestCase.testType}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Risk Level</label>
                  <span className={`inline-block px-3 py-1 text-sm font-semibold rounded border mt-2 ${getRiskLevelColor(selectedTestCase.riskLevel)}`}>
                    {selectedTestCase.riskLevel}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Preconditions</label>
                <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{selectedTestCase.preconditions}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Test Steps</label>
                <div className="text-sm text-slate-700 mt-1 whitespace-pre-wrap bg-slate-50 p-4 rounded border border-slate-200">
                  {selectedTestCase.testSteps}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Expected Results</label>
                <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{selectedTestCase.expectedResults}</p>
              </div>

              {selectedTestCase.linkedUserStories.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Linked User Stories</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTestCase.linkedUserStories.map((story, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded border border-blue-200">
                        {story}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedTestCase.complianceNotes && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase">Compliance Notes</label>
                  <p className="text-sm text-slate-700 mt-1">{selectedTestCase.complianceNotes}</p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase">Estimated Execution Time</label>
                <p className="text-sm text-slate-900 mt-1">{selectedTestCase.estimatedExecutionTime || 'Not specified'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
