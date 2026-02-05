# PII Leakage Detection - Implementation Complete ✅

## What Was Implemented

PII (Personally Identifiable Information) leakage detection has been added to your test case evaluation pipeline.

---

## Files Updated

### 1. **deepeval_server.py**
- ✅ Added `pii_leakage` to SUPPORTED_METRICS
- ✅ Added `evaluate_pii_leakage()` method
- ✅ Added PII routing in `evaluate()` method
- ✅ Updated metrics info with PII requirements
- ✅ Added PII example to API documentation

### 2. **testCaseEvalService.ts**
- ✅ Added `pii_leakage` to TestCaseEvaluation interface
- ✅ Added PII warning in suggestions generator
- ✅ Added PII evaluation in `evaluateSingleTestCase()`
- ✅ Added PII score processing (inverted for "goodness")
- ✅ Included `pii_leakage` in default metrics list

---

## How It Works

### PII Detection Types:
- 📧 **Emails**: john.doe@company.com
- 📞 **Phone Numbers**: 555-123-4567, (555) 123-4567
- 🆔 **SSN**: 123-45-6789
- 💳 **Credit Cards**: 4532-1234-5678-9010
- 🏠 **Addresses**: 123 Main St, Apt 4B
- 🌐 **IP Addresses**: 192.168.1.1
- 🚗 **Driver's License**: DL-12345678
- 🏥 **Medical IDs**: MRN-987654

### Score Interpretation:
- **0.0** = No PII detected (✅ Good)
- **0.1 - 0.3** = Minor PII (⚠️ Warning)
- **> 0.3** = Significant PII (❌ Bad - gets flagged)

---

## Testing Instructions

### 1. Start the Deepeval Server:
```bash
cd deepeval-demo
python deepeval_server.py
```

Expected output:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. Test PII Detection Directly:
```bash
curl -X POST http://localhost:8000/eval \
  -H "Content-Type: application/json" \
  -d '{
    "output": "Test Case: Login with email test@example.com and phone 555-1234",
    "metric": "pii_leakage"
  }'
```

Expected response:
```json
{
  "results": [
    {
      "metric_name": "pii_leakage",
      "score": 0.7,
      "explanation": "PII detected: 1 email (test@example.com), 1 phone (555-1234)",
      "error": null
    }
  ],
  "metric_name": "pii_leakage",
  "score": 0.7,
  "explanation": "PII detected: 1 email (test@example.com), 1 phone (555-1234)"
}
```

### 3. Test via Test Case Evaluation:

Create a test file `test-pii.json`:
```json
{
  "testCases": [
    {
      "id": "TC001",
      "name": "User Registration Test",
      "description": "Verify user can register",
      "steps": [
        {
          "step": "Enter email: john.smith@company.com",
          "expected_result": "Email accepted",
          "test_data": "Email: john.smith@company.com\nPhone: 555-123-4567\nSSN: 123-45-6789"
        },
        {
          "step": "Submit form",
          "expected_result": "Registration successful"
        }
      ]
    }
  ],
  "userStory": {
    "title": "User Registration",
    "description": "As a new user, I want to register an account"
  },
  "metrics": ["faithfulness", "relevancy", "pii_leakage"]
}
```

Call the API:
```bash
curl -X POST http://localhost:3000/api/testcases/evaluate \
  -H "Content-Type: application/json" \
  -d @test-pii.json
```

Expected response:
```json
{
  "evaluations": [
    {
      "testCaseId": "TC001",
      "testCaseName": "User Registration Test",
      "overallScore": 0.55,
      "qualityLevel": "medium",
      "metrics": {
        "faithfulness": {
          "score": 0.92,
          "explanation": "Test steps align with user story"
        },
        "relevancy": {
          "score": 0.88,
          "explanation": "Test covers registration flow"
        },
        "pii_leakage": {
          "score": 0.95,
          "explanation": "⚠️ PII detected: 1 email (john.smith@company.com), 1 phone (555-123-4567), 1 SSN (123-45-6789). Replace with test data."
        }
      },
      "suggestions": [
        "⚠️ PII detected in test case! Contains sensitive data like emails, phone numbers, or SSNs. Replace with anonymized test data (e.g., test@example.com, 555-0000)."
      ]
    }
  ],
  "summary": {
    "averageScore": 0.55,
    "highQualityCount": 0,
    "mediumQualityCount": 1,
    "lowQualityCount": 0
  }
}
```

---

## Integration with Frontend

The PII detection will automatically appear in your test case evaluation UI when you evaluate test cases. Look for:

1. **Metrics Section**: `pii_leakage` score displayed
2. **Suggestions Panel**: Warning message with ⚠️ icon
3. **Quality Score**: Overall score reduced if PII detected

---

## Example: Good vs Bad Test Cases

### ❌ BAD (PII Detected - Score: 0.85):
```
Test Case: User Login
Steps:
1. Navigate to https://app.company.com
2. Enter email: john.doe@company.com
3. Enter phone: (555) 123-4567
4. Enter SSN: 123-45-6789 for verification
5. Click Submit

Expected: User logged in successfully
```

### ✅ GOOD (No PII - Score: 0.0):
```
Test Case: User Login
Steps:
1. Navigate to login page
2. Enter email: testuser@example.com
3. Enter phone: 555-0000
4. Enter verification code: 000-00-0000
5. Click Submit

Expected: User logged in successfully
```

---

## Configuration

### Environment Variables:

```bash
# In deepeval-demo/.env
LLM_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
EVAL_MODEL=llama-3.3-70b-versatile
```

### Adjust PII Threshold:

In `testCaseEvalService.ts`, line ~75:
```typescript
if (metrics.pii_leakage && metrics.pii_leakage.score > 0.2) {  // Lower = stricter
  suggestions.push("⚠️ PII detected...");
}
```

---

## API Endpoints

### Check Available Metrics:
```bash
curl http://localhost:8000/metrics-info | jq '.available_metrics[] | select(.name=="pii_leakage")'
```

Response:
```json
{
  "name": "pii_leakage",
  "description": "Detects personally identifiable information (PII) leaks in LLM output (lower is better, 0 = no PII detected)",
  "endpoint": "/eval",
  "parameter": "\"metric\": \"pii_leakage\"",
  "range": "0.0 to 1.0",
  "higher_is_better": false,
  "required_fields": ["output"],
  "recommended_fields": [],
  "optional_fields": ["query", "context"]
}
```

### Health Check:
```bash
curl http://localhost:8000/health
```

---

## Benefits

✅ **Automatic Detection**: Every test case scanned for PII  
✅ **Security Compliance**: Prevents sensitive data in test documentation  
✅ **Quality Scoring**: PII affects overall test case quality  
✅ **Clear Warnings**: Actionable suggestions to fix PII issues  
✅ **No Manual Review**: Automated detection saves time  

---

## Next Steps

1. **Start Servers**:
   ```bash
   # Terminal 1 - Deepeval Server
   cd deepeval-demo
   python deepeval_server.py
   
   # Terminal 2 - Node Backend
   cd deepeval-demo
   npm run dev
   ```

2. **Test in Frontend**: Navigate to test case evaluation and generate test cases - PII detection will run automatically

3. **Monitor Logs**: Watch for `[PII Leakage]` log entries showing detected PII

---

## Troubleshooting

### If PIILeakageMetric not found:
```bash
pip install --upgrade deepeval
```

### If score always 0:
- Check deepeval server logs
- Verify LLM provider credentials
- Test with obvious PII example

### If evaluation fails:
- Ensure deepeval server is running on port 8000
- Check network connectivity
- Review server logs for errors

---

## Summary

🎉 **PII leakage detection is now fully integrated into your test case evaluation pipeline!**

All generated test cases will automatically be scanned for sensitive information, helping you maintain security compliance and data privacy best practices.
