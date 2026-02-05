# Visual Workflow Comparison

## Before: Single Page Layout

```
┌─────────────────────────────────────────────────────────┐
│                Test Cases Generator                      │
├────────────────┬───────────────────────────────────────┤
│                │                                        │
│   Stories      │      Selected Story Details            │
│   List         │                                        │
│                │      [Generate Button]                 │
│   - Story 1    │      [Generate with Eval Button]       │
│   - Story 2    │                                        │
│   - Story 3    │                                        │
│                │                                        │
├────────────────┴───────────────────────────────────────┤
│                                                         │
│        Generated Test Cases Table                       │
│        (appears below after generation)                 │
│                                                         │
│   ✓ TC1 | Description | Type | Priority | Steps |...   │
│   ✓ TC2 | Description | Type | Priority | Steps |...   │
│   ✓ TC3 | Description | Type | Priority | Steps |...   │
│                                                         │
│   [Download JSON] [Generate Feature File]              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Issues**:
- ❌ All content on one page - cluttered
- ❌ No clear workflow progression
- ❌ Difficult to edit test cases
- ❌ Export options mixed with generation


## After: 3-Tab Workflow

### Tab 1: Select Story & Generate
```
┌─────────────────────────────────────────────────────────┐
│              Test Cases Generator                        │
├─────────────────────────────────────────────────────────┤
│ [1. Select Story & Generate] │ 2. Review & Edit │ 3. Export │
├────────────────┬───────────────────────────────────────┤
│                │                                        │
│   Stories      │      Selected Story Details            │
│   List         │                                        │
│                │      Story: PROJ-123                   │
│   🔍 Search    │      Title: User Login Feature         │
│                │      Description: ...                  │
│   Number: 3    │      Acceptance Criteria: ...          │
│   Provider: ▼  │                                        │
│   Model: ▼     │      [🎯 Generate Test Cases]         │
│                │      [✨ Generate with Quality Eval]   │
│                │                                        │
└────────────────┴───────────────────────────────────────┘
```

### Tab 2: Review & Edit
```
┌─────────────────────────────────────────────────────────┐
│              Test Cases Generator                        │
├─────────────────────────────────────────────────────────┤
│ 1. Select Story & Generate │ [2. Review & Edit] │ 3. Export │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Quality Summary                                       │
│   Avg: 85%  ● High: 2  ● Medium: 1  ● Low: 0          │
│                                                         │
│   ┌───────────────────────────────────────────────┐   │
│   │ Test Case 1                            [🗑]   │   │
│   │ Name: [Successful Login Test           ]     │   │
│   │ Desc: [Verify user can login...        ]     │   │
│   │ Type: [Positive ▼] Priority: [High ▼]        │   │
│   │                                               │   │
│   │ Test Steps                         [+ Add]   │   │
│   │   Step 1: [Navigate to login page    ]       │   │
│   │   Expected: [Login page displays     ]       │   │
│   │   Data: [user@test.com              ] [🗑]  │   │
│   │                                               │   │
│   │ Quality Metrics:                              │   │
│   │ Faithfulness: 90% | Relevancy: 85%           │   │
│   │ Hallucination: 5% | PII: 0%                  │   │
│   └───────────────────────────────────────────────┘   │
│                                                         │
│                    [Proceed to Export →]               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Tab 3: Export
```
┌─────────────────────────────────────────────────────────┐
│              Test Cases Generator                        │
├─────────────────────────────────────────────────────────┤
│ 1. Select Story & Generate │ 2. Review & Edit │ [3. Export] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌──────────────────────┬──────────────────────────┐ │
│   │ Download Options     │ Integration Export       │ │
│   │                      │                          │ │
│   │ Select test cases    │ Export to Jira or        │ │
│   │ below and download   │ ServiceNow (Coming soon) │ │
│   │                      │                          │ │
│   │ [📥 Download JSON]   │ [📤 Export] (disabled)   │ │
│   │ [📄 Feature File]    │                          │ │
│   └──────────────────────┴──────────────────────────┘ │
│                                                         │
│   Preview & Select (3 test cases)                      │
│   ┌─────────────────────────────────────────────────┐ │
│   │ [✓] │ Name         │ Type │ Priority │ Steps   │ │
│   ├─────┼──────────────┼──────┼──────────┼─────────┤ │
│   │ ✓   │ TC1          │ Pos  │ High     │ 5       │ │
│   │ ✓   │ TC2          │ Neg  │ Medium   │ 3       │ │
│   │ ✓   │ TC3          │ E2E  │ High     │ 7       │ │
│   └─────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Key Improvements

### ✅ Clear Workflow Progression
**Before**: Everything on one page  
**After**: 3 distinct steps - Select → Review → Export

### ✅ Inline Editing
**Before**: No editing - need to regenerate  
**After**: Full inline editing with add/delete steps

### ✅ Auto-Navigation
**Before**: Manual scrolling to see results  
**After**: Auto-switches to Review tab after generation

### ✅ Tab State Management
**Before**: N/A  
**After**: Tabs disabled when no data, enabled after generation

### ✅ Organized Export
**Before**: Export buttons mixed with generation  
**After**: Dedicated Export tab with preview table

### ✅ Quality Metrics Visibility
**Before**: Metrics in table columns (cluttered)  
**After**: Dedicated section in Review tab for each test case

## User Experience Flow

### Before
1. User selects story
2. User clicks generate
3. User scrolls down to see results
4. User checks boxes in table
5. User downloads

### After
1. **Tab 1**: User selects story and clicks generate
2. **Tab 2**: Auto-navigates to Review, user edits test cases
3. **Tab 3**: User clicks "Proceed to Export", selects cases, downloads

**Result**: Clear, guided workflow with explicit steps

## Technical Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **File Management** | 1 large file | New component (old preserved) |
| **Maintainability** | 1113 lines, hard to navigate | 1132 lines, tab-organized |
| **Testing** | Test entire page | Test individual tabs |
| **State Management** | Complex conditional rendering | Clear tab-based states |
| **Navigation** | Manual scrolling | Auto-navigation between tabs |
| **Safety** | Risky to modify | New file, old preserved |

## Alignment with Epic & Story Extraction

Both components now follow the same pattern:

```
Epic & Story Extraction:
Tab 1: Upload
Tab 2: Review & Edit
Tab 3: Export

Test Cases Generator:
Tab 1: Select Story & Generate
Tab 2: Review & Edit
Tab 3: Export
```

**Consistency Benefits**:
- Users familiar with one component can use the other
- Shared design patterns
- Predictable workflow
- Similar inline editing experience
