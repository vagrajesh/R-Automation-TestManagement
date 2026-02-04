# DeepEval Integration Plan for Test Cases Generator

## Overview

Integrate DeepEval quality scoring with the test cases generator to evaluate and display quality metrics for AI-generated test cases.

**Goal:** Validate generated test cases against user stories to detect hallucinations, measure faithfulness, and ensure quality.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (localhost:3002)                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  TestCasesGenerator.tsx                                              │   │
│  │  - Generate Test Cases button (existing)                             │   │
│  │  - Generate with Quality Evaluation button (NEW)                     │   │
│  │  - Display quality scores (NEW)                                      │   │
│  │  - Highlight low-quality test cases (NEW)                            │   │
│  │  - Revalidate Quality button (NEW)                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (localhost:3000)                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  /api/test-cases/generate              (existing)                    │   │
│  │  /api/test-cases/evaluate              (NEW - Phase 2)               │   │
│  │  /api/test-cases/generate-with-eval    (NEW - Phase 3)               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEEPEVAL-DEMO (localhost:3001)                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  /api/test-cases/evaluate              (NEW - Phase 1)               │   │
│  │  - Faithfulness metric                                               │   │
│  │  - Hallucination detection                                           │   │
│  │  - Answer relevancy                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  DeepEval Python Server (localhost:8000)                             │   │
│  │  - Actual metric calculations                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: DeepEval Test Case Evaluation Endpoint

**Location:** `deepeval-demo/src/routes/testCaseRoutes.ts`

### 1.1 Create `/api/test-cases/evaluate` Endpoint

**Request:**
```typescript
POST /api/test-cases/evaluate
{
  testCases: [
    {
      id: string;
      name: string;
      description: string;
      steps: Array<{ step: string; expected_result: string }>;
    }
  ],
  userStory: {
    title: string;
    description: string;
    acceptanceCriteria?: string;
  },
  metrics?: string[];  // Optional: ["faithfulness", "hallucination", "answer_relevancy"]
}
```

**Response:**
```typescript
{
  evaluations: [
    {
      testCaseId: string;
      testCaseName: string;
      overallScore: number;        // 0.0 - 1.0 (weighted average)
      qualityLevel: "high" | "medium" | "low";
      metrics: {
        faithfulness: { score: number; explanation: string };
        hallucination: { score: number; explanation: string };
        relevancy: { score: number; explanation: string };
      };
      suggestions?: string[];      // Improvement suggestions for low scores
    }
  ],
  summary: {
    averageScore: number;
    highQualityCount: number;
    mediumQualityCount: number;
    lowQualityCount: number;
  }
}
```

### 1.2 Scoring Logic

| Overall Score | Quality Level | UI Color |
|--------------|---------------|----------|
| 0.8 - 1.0    | High          | Green    |
| 0.5 - 0.79   | Medium        | Yellow   |
| 0.0 - 0.49   | Low           | Red      |

### 1.3 Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `deepeval-demo/src/routes/testCaseRoutes.ts` | CREATE | New route file for test case evaluation |
| `deepeval-demo/src/services/testCaseEvalService.ts` | CREATE | Business logic for evaluation |
| `deepeval-demo/src/index.ts` | MODIFY | Register new routes |
| `deepeval-demo/.env` | MODIFY | Update PORT to 3001 |

---

## Phase 2: Backend Integration

**Location:** `backend/src/server.ts`

### 2.1 Create `/api/test-cases/evaluate` Proxy Endpoint

Backend calls deepeval-demo and returns results.

### 2.2 Environment Configuration

Add to `backend/.env`:
```env
DEEPEVAL_SERVICE_URL=http://localhost:3001
```

### 2.3 Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/src/server.ts` | MODIFY | Add `/api/test-cases/evaluate` endpoint |
| `backend/.env` | MODIFY | Add DEEPEVAL_SERVICE_URL |

---

## Phase 3: Combined Generate + Evaluate Endpoint

**Location:** `backend/src/server.ts`

### 3.1 Create `/api/test-cases/generate-with-eval` Endpoint

Combines generation and evaluation in one call.

**Request:**
```typescript
POST /api/test-cases/generate-with-eval
{
  story: { key, title, description, acceptanceCriteria, status, priority, source },
  numTestCases: number;
  provider: string;
  model: string;
}
```

**Response:**
```typescript
{
  testCases: [
    {
      // ...existing test case fields
      quality: {
        overallScore: number;
        qualityLevel: "high" | "medium" | "low";
        metrics: { ... };
        suggestions?: string[];
      }
    }
  ],
  qualitySummary: {
    averageScore: number;
    highQualityCount: number;
    mediumQualityCount: number;
    lowQualityCount: number;
  }
}
```

### 3.2 Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/src/server.ts` | MODIFY | Add combined endpoint |

---

## Phase 4: Frontend Quality Display

**Location:** `frontend/src/components/TestCasesGenerator.tsx`

### 4.1 UI Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Test Cases Generator                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Select Stories: [✓] US-001  [✓] US-002  [ ] US-003                         │
│  Number of Test Cases: [3]                                                   │
│                                                                              │
│  ┌──────────────────────┐    ┌────────────────────────────────────┐         │
│  │  Generate Test Cases │    │  Generate with Quality Evaluation  │         │
│  │      (existing)      │    │           ✨ (NEW)                  │         │
│  └──────────────────────┘    └────────────────────────────────────┘         │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Quality Summary: Avg: 0.78 │ ● High: 3 │ ● Medium: 1 │ ● Low: 1            │
├─────────────────────────────────────────────────────────────────────────────┤
│ ☐ │ ▶ │ Verify login success       │ [0.92 ●] │ Positive │ High │ Actions  │
│ ☐ │ ▶ │ Test invalid password      │ [0.85 ●] │ Negative │ High │ Actions  │
│ ☐ │ ▶ │ Check session timeout      │ [0.71 ●] │ Edge     │ Med  │ Actions  │
│ ☐ │ ▶ │ Verify email validation    │ [0.45 ●] │ Positive │ High │ Actions  │
│   │   │ ⚠️ Low quality: May contain hallucinations                          │
└─────────────────────────────────────────────────────────────────────────────┘

Legend: ● High (green)  ● Medium (yellow)  ● Low (red)
```

### 4.2 Button Behaviors

| Button | Endpoint | Result |
|--------|----------|--------|
| **Generate Test Cases** | `/api/test-cases/generate` | Test cases only (fast) |
| **Generate with Quality Evaluation** ✨ | `/api/test-cases/generate-with-eval` | Test cases + quality scores |
| **Revalidate Quality** | `/api/test-cases/evaluate` | Re-evaluate existing test cases |

### 4.3 Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/components/TestCasesGenerator.tsx` | MODIFY | Add quality display + new button |
| `frontend/src/components/QualityBadge.tsx` | CREATE | Reusable quality badge component |
| `frontend/src/components/QualitySummary.tsx` | CREATE | Summary card component |

---

## Implementation Order

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| Phase 1 | High | 2-3 hours | None |
| Phase 2 | High | 1-2 hours | Phase 1 |
| Phase 3 | High | 1-2 hours | Phase 1, 2 |
| Phase 4 | High | 3-4 hours | Phase 2, 3 |

**Recommended sequence:** Phase 1 → Phase 2 → Phase 3 → Phase 4

---

## Configuration Summary

### Port Configuration (IMPORTANT)

| Service | Current Port | New Port |
|---------|-------------|----------|
| Backend | 3000 | 3000 (unchanged) |
| Frontend | 3002 | 3002 (unchanged) |
| DeepEval Node.js | 3000 | **3001** (change required) |
| DeepEval Python | 8000 | 8000 (unchanged) |

### Environment Variables

**deepeval-demo/.env:**
```env
PORT=3001
DEEPEVAL_URL=http://localhost:8000/eval
GROQ_API_KEY=your-groq-key
```

**backend/.env:**
```env
DEEPEVAL_SERVICE_URL=http://localhost:3001
```

---

## Commands to Start Services

```bash
# Terminal 1: DeepEval Python Server
cd deepeval-demo
python deepeval_server.py

# Terminal 2: DeepEval Node.js (port 3001)
cd deepeval-demo
npm run dev

# Terminal 3: Backend (port 3000)
cd backend
npm run dev

# Terminal 4: Frontend (port 3002)
cd frontend
npm run dev
```

---

## Ready to Implement?

**Confirm to start Phase 1:**
- Create `deepeval-demo/src/routes/testCaseRoutes.ts`
- Create `deepeval-demo/src/services/testCaseEvalService.ts`
- Update `deepeval-demo/src/index.ts` to register routes
- Update `deepeval-demo/.env` to use PORT=3001
