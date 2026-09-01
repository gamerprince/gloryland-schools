# Batch 2: Security Rules & Composite Indexes

## Overview

This batch deploys:
1. **Firestore Security Rules** (`firestore.rules`) — restricts access to authenticated users only
2. **Composite Indexes** (`firestore-indexes.json`) — enables efficient multi-field queries

---

## Step 1: Deploy Security Rules

### Option A: Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com) → Select **fir-configjs-80ffe**
2. **Firestore Database** → **Rules** tab
3. **Clear the current rules** and copy-paste the entire content from `firestore.rules`
4. Click **Publish**

**That's it!** Rules are now active.

### Option B: Firebase CLI

If you have Firebase CLI installed (`npm install -g firebase-tools`):

```bash
cd "c:\Users\User\Desktop\gloryland web"
firebase login
firebase deploy --only firestore:rules
```

---

## Step 2: Create Composite Indexes

### ⚠️ Important: Firestore May Auto-Create These

When you deploy the rules and run queries, Firestore will **prompt you to create indexes** if they don't exist. You can:

**Option A: Auto-Create (Recommended)**
1. Deploy rules first (Step 1)
2. In the app, trigger queries that need indexes:
   - Student result lookup (uses 4-field index)
   - Ranking results (uses 4-field index)
   - Admin broadsheet (uses 4-field index)
3. Firestore will show a link to **create the index** → click it

**Option B: Manually Create in Console**

1. Go to **Firestore Database** → **Indexes** tab
2. Click **Create Index**
3. Add three indexes (copy from `firestore-indexes.json`):

**Index 1: Result Lookup**
```
Collection: compiledResults
- studentNameLower (Ascending)
- className (Ascending)
- term (Ascending)
- session (Ascending)
```

**Index 2: Ranking/Publishing**
```
Collection: compiledResults
- className (Ascending)
- subject (Ascending)
- term (Ascending)
- session (Ascending)
```

**Index 3: Admin Broadsheet**
```
Collection: compiledResults
- className (Ascending)
- term (Ascending)
- session (Ascending)
- published (Ascending)
```

Index creation takes **1–5 minutes**. You'll see a **building** status → **✅ enabled** when done.

### Option C: Deploy via CLI

```bash
firebase deploy --only firestore:indexes
```

---

## Step 3: Verify Rules & Indexes

### Check Rules
1. **Firestore Database** → **Rules** tab
2. Confirm your rules are published ✅

### Check Indexes
1. **Firestore Database** → **Indexes** tab
2. Wait for all 3 indexes to show **Status: Enabled** ✅

---

## What These Rules Protect

✅ **Students** — Can only read/write their own profile  
✅ **Teachers** — Can only create & manage their own tests and results  
✅ **Admins** — Can publish results and toggle fee-cleared status  
✅ **Results** — Published results are readable; unpublished are teacher/admin only  
✅ **Audit Logs** — Only admins can read  
✅ **Attempts** — Immutable once created; teachers can view for their tests  

❌ **Deny all other access** — Default: closed

---

## Next: Batch 3

Once rules and indexes are deployed and verified, reply and I'll start **Batch 3: Audit Logging & Admin Safeguards** ✅
