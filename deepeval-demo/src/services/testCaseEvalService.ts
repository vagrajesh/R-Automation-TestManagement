import { evalWithFields, EvalResult } from "./evalClient.js";

/**
 * Test Case Evaluation Service
 * Evaluates generated test cases against user stories for quality metrics
 */

export interface TestCaseInput {
  id: string;
  name: string;
  description: string;
  steps: Array<{ step: string; expected_result: string; test_data?: string }>;
}

export interface UserStoryInput {
  title: string;
  description: string;
  acceptanceCriteria?: string;
}

export interface MetricScore {
  score: number;
  explanation: string;
}

export interface TestCaseEvaluation {
  testCaseId: string;
  testCaseName: string;
  overallScore: number;
  qualityLevel: "high" | "medium" | "low";
  metrics: {
    faithfulness?: MetricScore;
    relevancy?: MetricScore;
    hallucination?: MetricScore;
    completeness?: MetricScore;
    pii_leakage?: MetricScore;
  };
  suggestions?: string[];
}

export interface EvaluationSummary {
  averageScore: number;
  highQualityCount: number;
  mediumQualityCount: number;
  lowQualityCount: number;
}

export interface TestCaseEvaluationResult {
  evaluations: TestCaseEvaluation[];
  summary: EvaluationSummary;
}

/**
 * Determine quality level based on score
 */
function getQualityLevel(score: number): "high" | "medium" | "low" {
  if (score >= 0.8) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

/**
 * Generate improvement suggestions based on metrics
 */
function generateSuggestions(
  metrics: TestCaseEvaluation["metrics"],
  qualityLevel: string
): string[] {
  const suggestions: string[] = [];

  if (qualityLevel === "low" || qualityLevel === "medium") {
    if (metrics.faithfulness && metrics.faithfulness.score < 0.7) {
      suggestions.push(
        "Test case may contain steps not aligned with the user story. Review and ensure all steps are derived from requirements."
      );
    }
    if (metrics.relevancy && metrics.relevancy.score < 0.7) {
      suggestions.push(
        "Test case may not fully address the user story requirements. Consider adding steps to cover missing acceptance criteria."
      );
    }
    if (metrics.hallucination && metrics.hallucination.score > 0.3) {
      suggestions.push(
        "Test case may contain assumptions or steps not grounded in the user story. Remove any speculative or unsupported test steps."
      );
    }
    if (metrics.completeness && metrics.completeness.score < 0.7) {
      suggestions.push(
        "Test case may not completely cover all acceptance criteria. Review the user story and add missing test coverage."
      );
    }
    if (metrics.pii_leakage && metrics.pii_leakage.score > 0.2) {
      suggestions.push(
        "⚠️ PII detected in test case! Contains sensitive data like emails, phone numbers, or SSNs. Replace with anonymized test data (e.g., test@example.com, 555-0000)."
      );
    }
    if (suggestions.length === 0) {
      suggestions.push(
        "Consider reviewing the test case for completeness and accuracy against the original requirements."
      );
    }
  }

  return suggestions;
}

/**
 * Format test case as text for evaluation
 */
function formatTestCaseAsText(testCase: TestCaseInput): string {
  const stepsText = testCase.steps
    .map(
      (s, i) =>
        `Step ${i + 1}: ${s.step}\n  Expected: ${s.expected_result}${s.test_data ? `\n  Test Data: ${s.test_data}` : ""}`
    )
    .join("\n");

  return `Test Case: ${testCase.name}
Description: ${testCase.description}
Steps:
${stepsText}`;
}

/**
 * Format user story as context for evaluation
 */
function formatUserStoryAsContext(story: UserStoryInput): string {
  let context = `User Story: ${story.title}
Description: ${story.description}`;

  if (story.acceptanceCriteria) {
    context += `\nAcceptance Criteria: ${story.acceptanceCriteria}`;
  }

  return context;
}

/**
 * Evaluate a single test case against the user story
 */
async function evaluateSingleTestCase(
  testCase: TestCaseInput,
  userStory: UserStoryInput,
  metricsToEvaluate: string[],
  llmProvider?: string
): Promise<TestCaseEvaluation> {
  const testCaseText = formatTestCaseAsText(testCase);
  const storyContext = formatUserStoryAsContext(userStory);
  const provider = llmProvider || "groq"; // Default to Groq if not provided

  const metrics: TestCaseEvaluation["metrics"] = {};
  const scores: number[] = [];

  // Create promises for all metrics in parallel
  const metricPromises: Promise<[string, number, string]>[] = [];

  // Faithfulness evaluation
  if (metricsToEvaluate.includes("faithfulness")) {
    metricPromises.push(
      (async () => {
        try {
          const result = await evalWithFields({
            context: [storyContext],
            output: testCaseText,
            metric: "faithfulness",
            provider: provider,
          });
          return ["faithfulness", result.score ?? 0, result.explanation || "No explanation provided"] as const;
        } catch (error) {
          console.error(`Faithfulness evaluation failed for ${testCase.id}:`, error);
          return ["faithfulness", 0, `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`] as const;
        }
      })()
    );
  }

  // Relevancy evaluation
  if (metricsToEvaluate.includes("answer_relevancy") || metricsToEvaluate.includes("relevancy")) {
    metricPromises.push(
      (async () => {
        try {
          const result = await evalWithFields({
            query: `Generate test cases for: ${userStory.title}. ${userStory.description}`,
            output: testCaseText,
            metric: "answer_relevancy",
            provider: provider,
          });
          return ["relevancy", result.score ?? 0, result.explanation || "No explanation provided"] as const;
        } catch (error) {
          console.error(`Relevancy evaluation failed for ${testCase.id}:`, error);
          return ["relevancy", 0, `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`] as const;
        }
      })()
    );
  }

  // Hallucination evaluation
  if (metricsToEvaluate.includes("hallucination")) {
    metricPromises.push(
      (async () => {
        try {
          const result = await evalWithFields({
            context: [storyContext],
            output: testCaseText,
            metric: "hallucination",
            provider: provider,
          });
          // DeepEval hallucination: 0 = no hallucinations (good), 1 = complete hallucinations (bad)
          // Keep as-is: lower is better (0% = no hallucinations, 100% = fully hallucinated)
          const score = result.score ?? 0;
          console.log(`[Hallucination] Raw score from DeepEval: ${score}`, { testCaseId: testCase.id, score });
          return ["hallucination", score, result.explanation || "No explanation provided"] as const;
        } catch (error) {
          console.error(`Hallucination evaluation failed for ${testCase.id}:`, error);
          return ["hallucination", 0, `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`] as const;
        }
      })()
    );
  }

  // Completeness evaluation
  if (metricsToEvaluate.includes("completeness")) {
    metricPromises.push(
      (async () => {
        try {
          const result = await evalWithFields({
            query: `Does the following test case completely cover the user story and acceptance criteria?\n${storyContext}`,
            output: testCaseText,
            metric: "answer_relevancy",
            provider: provider,
          });
          return ["completeness", result.score ?? 0, result.explanation || "No explanation provided"] as const;
        } catch (error) {
          console.error(`Completeness evaluation failed for ${testCase.id}:`, error);
          return ["completeness", 0, `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`] as const;
        }
      })()
    );
  }

  // PII Leakage evaluation
  if (metricsToEvaluate.includes("pii_leakage")) {
    metricPromises.push(
      (async () => {
        try {
          const result = await evalWithFields({
            output: testCaseText,
            metric: "pii_leakage",
            provider: provider,
          });
          // DeepEval PII: 0 = no PII (good), higher = PII detected (bad)
          const score = result.score ?? 0;
          console.log(`[PII Leakage] Score: ${score}`, { testCaseId: testCase.id, score });
          return ["pii_leakage", score, result.explanation || "No PII detected"] as const;
        } catch (error) {
          console.error(`PII Leakage evaluation failed for ${testCase.id}:`, error);
          return ["pii_leakage", 0, `Evaluation failed: ${error instanceof Error ? error.message : "Unknown error"}`] as const;
        }
      })()
    );
  }

  // Wait for all metrics to complete
  const results = await Promise.all(metricPromises);
  
  // Process results
  for (const [metricName, score, explanation] of results) {
    if (metricName === "faithfulness") {
      metrics.faithfulness = { score, explanation };
      scores.push(score);
    } else if (metricName === "relevancy") {
      metrics.relevancy = { score, explanation };
      scores.push(score);
    } else if (metricName === "hallucination") {
      metrics.hallucination = { score, explanation };
      scores.push(score);
    } else if (metricName === "completeness") {
      metrics.completeness = { score, explanation };
      scores.push(score);
    } else if (metricName === "pii_leakage") {
      metrics.pii_leakage = { score, explanation };
      // PII leakage score: 0.0 = good (no PII), 1.0 = bad (PII detected)
      // Invert for overall score calculation (convert to goodness: 1 - score)
      scores.push(1 - score);
    }
  }

  // Calculate overall score (average of all metrics)
  const overallScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const qualityLevel = getQualityLevel(overallScore);
  const suggestions = generateSuggestions(metrics, qualityLevel);

  return {
    testCaseId: testCase.id,
    testCaseName: testCase.name,
    overallScore: Math.round(overallScore * 100) / 100,
    qualityLevel,
    metrics,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Evaluate multiple test cases against a user story
 */
export async function evaluateTestCases(
  testCases: TestCaseInput[],
  userStory: UserStoryInput,
  metrics: string[] = ["faithfulness", "relevancy", "hallucination", "completeness", "pii_leakage"],
  llmProvider?: string
): Promise<TestCaseEvaluationResult> {
  console.log(`[TestCaseEval] Evaluating ${testCases.length} test cases`);
  console.log(`[TestCaseEval] User Story: ${userStory.title}`);
  console.log(`[TestCaseEval] Metrics: ${metrics.join(", ")}`);
  console.log(`[TestCaseEval] LLM Provider: ${llmProvider || "groq (default)"}`);

  // Evaluate each test case in parallel for better performance
  const evaluationPromises = testCases.map(testCase => {
    console.log(`[TestCaseEval] Evaluating: ${testCase.name}`);
    return evaluateSingleTestCase(testCase, userStory, metrics, llmProvider)
      .then(evaluation => {
        console.log(`[TestCaseEval] Score: ${evaluation.overallScore} (${evaluation.qualityLevel})`);
        return evaluation;
      });
  });

  const evaluations = await Promise.all(evaluationPromises);

  // Calculate summary
  const scores = evaluations.map((e) => e.overallScore);
  const summary: EvaluationSummary = {
    averageScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
    highQualityCount: evaluations.filter((e) => e.qualityLevel === "high").length,
    mediumQualityCount: evaluations.filter((e) => e.qualityLevel === "medium").length,
    lowQualityCount: evaluations.filter((e) => e.qualityLevel === "low").length,
  };

  console.log(`[TestCaseEval] Summary: Avg=${summary.averageScore}, High=${summary.highQualityCount}, Medium=${summary.mediumQualityCount}, Low=${summary.lowQualityCount}`);

  return { evaluations, summary };
}
