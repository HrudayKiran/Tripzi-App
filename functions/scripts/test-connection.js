/**
 * Simple test script to debug Firestore connection
 */

const admin = require('firebase-admin');
const path = require('path');

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

console.log('Project ID:', serviceAccount.project_id);
console.log('Client Email:', serviceAccount.client_email);

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
        storageBucket: `${serviceAccount.project_id}.appspot.com`
    });
    console.log('Admin SDK initialized successfully');
} catch (e) {
    console.error('Init failed:', e.message);
    process.exit(1);
}

const db = admin.firestore();
db.settings({ preferRest: true });

console.log('\nAttempting to write to Firestore...');

// Simple write test
db.collection('test').doc('connection_test').set({
    message: 'Connection successful!',
    timestamp: admin.firestore.FieldValue.serverTimestamp()
})
    .then(() => {
        console.log('✅ SUCCESS! Firestore write worked!');
        // Clean up test doc
        return db.collection('test').doc('connection_test').delete();
    })
    .then(() => {
        console.log('✅ Test document cleaned up');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Firestore error:', error.code, error.message);
        console.log('\nFull error:', JSON.stringify(error, null, 2));
        process.exit(1);
    });
