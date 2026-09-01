# Gloryland Foundation Academy - Codebase Guide

## Architecture Overview

This is a role-based educational platform (exam/test system + student results portal) built with **vanilla JavaScript + Firebase Firestore**. Three user tiers: **Students** (anonymous), **Teachers** (create/manage tests), **Admins** (fee management, results publishing).

### Core Data Model

```
tests/           {id: string, teacherId, title, ...}
├── {testId}/questions/  {id: string, text, options, correctAnswer}
attempts/        {studentId, testId, answers[], score}
compiledResults/ {studentNameLower, className, term, session, subject, total, grade, published, feeCleared}
teachers/        {id: uid, email, ...}
admins/          {id: uid, email, ...}
```

**Critical pattern**: Document IDs are UIDs for `teachers` and `admins` collections (used in [auth-guard.js](auth-guard.js#L19-L24)).

---

## Key Components & Workflows

### 1. **Authentication & Authorization** (`auth-guard.js`)
- `requireRole(role)` returns promise with `{user, profile}` after verifying user exists in Firestore role collection
- Redirects to `index.html` if unauthenticated or role mismatch
- **Usage**: Every teacher/admin page imports & calls this at module load

### 2. **Student Exam Flow** (`student.html` + `student.js`)
- **student.html**: Embedded inline script loads tests, displays quiz UI, saves `attempts` collection
- **student.js**: Standalone tool for checking published results (no auth required)
- **Key query**: `where("studentNameLower", "==", ...)` + class/term/session filters

### 3. **Teacher Dashboard** (`teacher-dashboard.html` through `teacher-view-attempts.html`)
- **Dashboard**: Loads stats from `tests` (by teacherId) + nested `attempts` queries
- **Create/Edit Tests**: Manages subcollection `tests/{testId}/questions`
- **Results Entry**: `teacher-compiled-result.html` writes to `compiledResults`
- **Navigation**: Shared nav bar linking all teacher pages

### 4. **Admin Panel** (`admin.html`)
- **Fee Management**: Query `compiledResults` by class/term/session, bulk update `feeCleared` flag
- **Results Publishing**: Batch update `published` flag across multiple student records
- **Broadsheet**: `admin-broadsheet.html` + `admin-broadsheet.js` generates class-wide report with rank calculations (`rank-results.js`)

---

## Critical Developer Patterns

### Firebase Module Import Pattern
All files use **Firebase CDN imports (not npm)**:
```javascript
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
// ✓ All scripts must be type="module" in HTML
```
[firebase-config.js](firebase-config.js) exports singleton `app`, `db`, `auth`.

### DOM Query Shorthand
```javascript
const $ = id => document.getElementById(id);
// Consistent across all scripts for brevity
```

### Firestore Query Patterns
- **No pagination**: All queries use `getDocs()` (entire collection loaded into memory)
- **Composite queries**: Multiple `where()` clauses common (e.g., class + term + session)
- **Batch updates**: Uses `writeBatch` for atomic multi-document updates ([rank-results.js](rank-results.js#L3))

### UI Framework
- **Tailwind CSS** v3 (CDN only) for all styling
- **No component libraries**: Pure HTML + inline scripts in most files
- **Layout patterns**: Grid/flex utilities, shadow classes for cards

---

## Important Integration Points

1. **Student Name Queries** (case-insensitive): Store lowercase in `studentNameLower` field; queries compare against `.toLowerCase()`
2. **Term/Session Format**: Integer for term, string for session ("2024/2025" typical)
3. **Grade Calculation**: Stored in `compiledResults`; assume external tool/admin manually inputs or derived from `total`
4. **Result Withheld Logic** ([student.js](student.js#L54-L59)): If `feeCleared !== true`, prevent result display
5. **Teacher-Created Tests**: Only teachers can see/manage own tests via `where("teacherId", "==", uid)` filter

---

## Debugging Hotspots

- **"Access denied" alerts**: Check `teachers`/`admins` collection for user's UID as document ID
- **Empty query results**: Verify composite query parameters match stored document fields exactly
- **Test not showing**: Ensure `published === true` in student exam flow
- **Batch operations fail silently**: Check browser console; `writeBatch` doesn't throw in try-catch easily

---

## File Naming Convention

- `-` separates concerns: `teacher-dashboard.html`, `admin-broadsheet.js`
- `*.js` files are either standalone tools (`student.js`, `rank-results.js`) or inline scripts in HTML
- No separate routing layer; HTML files link directly
