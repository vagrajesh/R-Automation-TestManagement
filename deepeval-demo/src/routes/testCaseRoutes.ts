import { Router, Request, Response, NextFunction } from "express";
import {
  evaluateTestCases,
  TestCaseInput,
  UserStoryInput,
} from "../services/testCaseEvalService.js";

const router = Router();

/**
 * Error handler middleware for async routes
 */
const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * POST /api/test-cases/evaluate
 * Evaluate generated test cases against a user story
 *
 * Request body:
 * {
 *   testCases: Array<{
 *     id: string;
 *     name: string;
 *     description: string;
 *     steps: Array<{ step: string; expected_result: string; test_data?: string }>;
 *   }>,
 *   userStory: {
 *     title: string;
 *     description: string;
 *     acceptanceCriteria?: string;
 *   },
 *   metrics?: string[]  // Optional: ["faithfulness", "relevancy"]
 * }
 *
 * Response:
 * {
 *   evaluations: Array<{
 *     testCaseId: string;
 *     testCaseName: string;
 *     overallScore: number;
 *     qualityLevel: "high" | "medium" | "low";
 *     metrics: {
 *       faithfulness?: { score: number; explanation: string };
 *       relevancy?: { score: number; explanation: string };
 *     };
 *     suggestions?: string[];
 *   }>,
 *   summary: {
 *     averageScore: number;
 *     highQualityCount: number;
 *     mediumQualityCount: number;
 *     lowQualityCount: number;
 *   }
 * }
 */
router.post(
  "/test-cases/evaluate",
  asyncHandler(async (req: Request, res: Response) => {
    const { testCases, userStory, metrics, provider } = req.body;

    // Validation
    if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
      return res.status(400).json({
        error: "Missing or invalid required field: testCases (must be a non-empty array)",
      });
    }

    if (!userStory || !userStory.title || !userStory.description) {
      return res.status(400).json({
        error: "Missing required field: userStory (must have title and description)",
      });
    }

    // Validate each test case
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      if (!tc.id || !tc.name || !tc.description) {
        return res.status(400).json({
          error: `Invalid test case at index ${i}: must have id, name, and description`,
        });
      }
      if (!tc.steps || !Array.isArray(tc.steps)) {
        return res.status(400).json({
          error: `Invalid test case at index ${i}: steps must be an array`,
        });
      }
    }

    // Validate metrics if provided
    const validMetrics = ["faithfulness", "relevancy", "answer_relevancy", "hallucination", "completeness", "pii_leakage"];
    const effectiveMetrics = metrics || ["faithfulness", "relevancy"];
    
    for (const metric of effectiveMetrics) {
      if (!validMetrics.includes(metric)) {
        return res.status(400).json({
          error: `Invalid metric: ${metric}. Valid metrics are: ${validMetrics.join(", ")}`,
        });
      }
    }

    console.log(`[POST /test-cases/evaluate] Received ${testCases.length} test cases for evaluation`);

    try {
      const result = await evaluateTestCases(
        testCases as TestCaseInput[],
        userStory as UserStoryInput,
        effectiveMetrics,
        provider
      );

      return res.json(result);
    } catch (error) {
      console.error("[POST /test-cases/evaluate] Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({
        error: `Test case evaluation failed: ${errorMessage}`,
      });
    }
  })
);

/**
 * GET /api/test-cases/evaluate/health
 * Health check for test case evaluation service
 */
router.get("/test-cases/evaluate/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "test-case-evaluation",
    timestamp: new Date().toISOString(),
    availableMetrics: ["faithfulness", "relevancy", "hallucination", "completeness", "pii_leakage"],
  });
});

export default router;
