/**
 * Bursary Ledger Migration - Add Missing 'term' Field
 * 
 * Problem: Old ledger records don't have a 'term' field, so they don't show in the ledger viewer
 * Solution: This script adds the 'term' field to all records that lack it
 * 
 * Run: node fix-bursary-ledger-term.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
  path.join(__dirname, 'serviceAccountKey.json');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: serviceAccountKey.json not found!');
  console.error('   1. Go to Firebase Console > Project Settings > Service Accounts');
  console.error('   2. Click "Generate New Private Key"');
  console.error('   3. Save as serviceAccountKey.json in the same folder as this script');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  databaseURL: 'https://fir-configjs-80ffe.firebaseio.com'
});

const db = admin.firestore();

async function fixBursaryLedgerTerm() {
  console.log('\n🔧 Starting Bursary Ledger Term Migration...\n');

  try {
    const snap = await db.collection('bursaryLedgers').get();
    const batch = db.batch();
    let updated = 0;
    let recordsWithoutTerm = [];

    snap.forEach(doc => {
      const data = doc.data();
      
      // Check if term field is missing
      if (!data.term) {
        recordsWithoutTerm.push({
          id: doc.id,
          pupilName: data.pupilName,
          className: data.className
        });
        
        // Add default term: "1st Term"
        batch.update(doc.ref, { term: '1st Term' });
        updated++;
      }
    });

    if (updated === 0) {
      console.log('✅ All records already have the term field. No updates needed.');
      return;
    }

    // Commit the batch update
    await batch.commit();
    console.log(`✅ Successfully updated ${updated} ledger records with term field!\n`);
    
    console.log('📋 Updated records:');
    recordsWithoutTerm.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.pupilName} (${r.className}) → term: "1st Term"`);
    });

    console.log('\n✨ Migration complete! All ledger records now have the term field.\n');

  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixBursaryLedgerTerm();
