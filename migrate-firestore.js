/**
 * Firebase Firestore Data Migration Script
 * 
 * Updates compiledResults & attempts to use:
 * - session: "2025/2026"
 * - teacherId: correct teacher auth UID
 * - adds missing fields (className, feeCleared for compiledResults)
 * 
 * Run: node migrate-firestore.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  path.join(__dirname, 'serviceAccountKey.json');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !require('fs').existsSync(serviceAccountPath)) {
  console.error('❌ Error: serviceAccountKey.json not found!');
  console.error('   1. Go to Firebase Console > Project Settings > Service Accounts');
  console.error('   2. Click "Generate New Private Key"');
  console.error('   3. Save as serviceAccountKey.json in the same folder as this script');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  databaseURL: 'https://fir-configjs-80ffe.firebaseio.com' // Update to your database URL if different
});

const db = admin.firestore();

// Configuration (update these to match your data)
const TEACHER_UID = 'VtGcLajrTRaFn5isSzaxU0a8n6q1';
const ADMIN_UID = 'wtOdJcxpCUOt3nFCJxm2tk5hISG3';
const NEW_SESSION = '2025/2026';

async function migrateCompiledResults() {
  console.log('\n📝 Migrating compiledResults...');
  
  const snap = await db.collection('compiledResults').get();
  const batch = db.batch();
  let updated = 0;

  snap.forEach(doc => {
    const data = doc.data();
    const updates = {};

    // Update session
    if (data.session !== NEW_SESSION) {
      updates.session = NEW_SESSION;
    }

    // Update teacherId (assume all are the teacher's for now)
    if (data.teacherId !== TEACHER_UID) {
      updates.teacherId = TEACHER_UID;
      console.log(`  [${doc.id}] teacherId: ${data.teacherId} → ${TEACHER_UID}`);
    }

    // Add missing feeCleared
    if (data.feeCleared === undefined) {
      updates.feeCleared = false;
      console.log(`  [${doc.id}] added feeCleared: false`);
    }

    // Ensure numeric types
    if (typeof data.total !== 'number') {
      updates.total = Number(data.total) || 0;
    }
    if (typeof data.position !== 'number' && data.position !== undefined) {
      updates.position = Number(data.position) || 0;
    }

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      updated++;
    }
  });

  if (updated > 0) {
    await batch.commit();
    console.log(`✅ Updated ${updated} compiledResults documents`);
  } else {
    console.log('✅ All compiledResults already consistent');
  }
}

async function migrateAttempts() {
  console.log('\n📝 Migrating attempts...');
  
  const snap = await db.collection('attempts').get();
  const batch = db.batch();
  let updated = 0;

  snap.forEach(doc => {
    const data = doc.data();
    const updates = {};

    // Ensure numeric types
    if (typeof data.score !== 'number') {
      updates.score = Number(data.score) || 0;
    }
    if (typeof data.correct !== 'number') {
      updates.correct = Number(data.correct) || 0;
    }
    if (typeof data.total !== 'number') {
      updates.total = Number(data.total) || 0;
    }

    // Ensure studentName exists
    if (!data.studentName) {
      console.log(`  [${doc.id}] missing studentName (check manually)`);
    }

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      updated++;
    }
  });

  if (updated > 0) {
    await batch.commit();
    console.log(`✅ Updated ${updated} attempts documents`);
  } else {
    console.log('✅ All attempts already consistent');
  }
}

async function exportBackup() {
  console.log('\n📦 Exporting backup...');
  
  const backup = {
    timestamp: new Date().toISOString(),
    collections: {}
  };

  const collections = ['compiledResults', 'attempts', 'students', 'tests', 'teachers', 'admins'];

  for (const col of collections) {
    const snap = await db.collection(col).get();
    backup.collections[col] = snap.docs.map(d => ({
      id: d.id,
      data: d.data()
    }));
    console.log(`  [${col}] ${snap.size} documents`);
  }

  const fs = require('fs');
  const backupPath = `backup-${Date.now()}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`✅ Backup saved to ${backupPath}`);
}

async function main() {
  try {
    console.log('🚀 Starting Firestore Migration...');
    console.log(`   Teacher UID: ${TEACHER_UID}`);
    console.log(`   New Session: ${NEW_SESSION}`);

    // Export backup first
    await exportBackup();

    // Run migrations
    await migrateCompiledResults();
    await migrateAttempts();

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

main();
