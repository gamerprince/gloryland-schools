# Batch 1: Backup & Data Migration

## Step 1: Manual Backup (Do This First!)

**Via Firebase Console:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `fir-configjs-80ffe`
3. **Firestore Database** → **Backups** (or use **Export**)
4. Click **Manage Backups** → **Create Backup**
5. Export collections: `compiledResults`, `attempts`, `students`, `tests`, `teachers`, `admins`
6. Save locally for reference

**OR via gcloud CLI:**
```bash
gcloud firestore export gs://fir-configjs-80ffe.appspot.com/backups/backup-$(date +%s) \
  --collection-ids=compiledResults,attempts,students,tests,teachers,admins
```

---

## Step 2: Run Node.js Migration Script

### Prerequisites:
1. **Node.js installed** (v14+)
2. **Firebase Admin SDK installed:**
   ```bash
   cd "c:\Users\User\Desktop\gloryland web"
   npm install firebase-admin
   ```

3. **Service Account Key:**
   - Go to [Firebase Console](https://console.firebase.google.com) → Project Settings → **Service Accounts**
   - Click **Generate New Private Key** → Save as `serviceAccountKey.json` in the same folder as `migrate-firestore.js`

### Run Migration:
```bash
cd "c:\Users\User\Desktop\gloryland web"
node migrate-firestore.js
```

**Expected Output:**
```
🚀 Starting Firestore Migration...
   Teacher UID: VtGcLajrTRaFn5isSzaxU0a8n6q1
   New Session: 2025/2026

📦 Exporting backup...
  [compiledResults] 3 documents
  [attempts] 1 documents
  ...
✅ Backup saved to backup-1705864800000.json

📝 Migrating compiledResults...
  [F6w7G7787tj2eCR4xmUw] session: 2025 → 2025/2026
  [F6w7G7787tj2eCR4xmUw] added feeCleared: false
✅ Updated 3 compiledResults documents

📝 Migrating attempts...
✅ All attempts already consistent

✅ Migration complete!
```

---

## Step 3: Verify in Firebase Console

After migration completes:
1. Go to **Firestore Database** → **Collections** 
2. Open `compiledResults` and verify:
   - `session` = `"2025/2026"` ✅
   - `teacherId` = `VtGcLajrTRaFn5isSzaxU0a8n6q1` ✅
   - `feeCleared` = `false` ✅
   - All numeric fields are numbers ✅

---

## Rollback (If Needed)

If anything goes wrong:
1. **In Firebase Console:** Firestore Database → Backups → **Restore** from your backup
2. **OR manually:** Use the exported `backup-*.json` file to restore data

---

## Next: Batch 2

Once verified, proceed to **Batch 2: Security Rules & Indexes** ✅
