const { admin } = require('./_admin_init');

const db = admin.firestore();

async function cleanupDuplicates() {
    console.log("Starting cleanup...");

    // 1. Cleanup Duplicate Notifications
    // Logic: Same recipient, same type, same entityId, created within 5 seconds of each other
    // Delete the one created by 'client' (if distinguisable) or later one.
    // For now, simple check: identical title/body/recipient within 2s.

    // FETCH ALL users to iterate subcollections (inefficient but necessary for subcollections)
    const usersSnap = await db.collection('users').get();
    console.log(`Checking notifications for ${usersSnap.size} users...`);

    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const notifsRef = db.collection('notifications').doc(userId).collection('items');
        const snapshot = await notifsRef.orderBy('createdAt', 'desc').get();

        const docs = snapshot.docs;
        if (docs.length < 2) continue;

        let deletedCount = 0;
        for (let i = 0; i < docs.length - 1; i++) {
            const curr = docs[i].data();
            const next = docs[i + 1].data();
            const currRef = docs[i].ref;

            // Check signature
            if (curr.type === next.type &&
                curr.entityId === next.entityId &&
                curr.title === next.title &&
                curr.body === next.body) {

                // Check time diff
                const t1 = curr.createdAt?.toMillis() || 0;
                const t2 = next.createdAt?.toMillis() || 0;

                if (Math.abs(t1 - t2) < 5000) { // 5 seconds window
                    console.log(`Deleting duplicate notification ${currRef.id} for user ${userId}`);
                    await currRef.delete();
                    deletedCount++;
                }
            }
        }
        if (deletedCount > 0) console.log(`Deleted ${deletedCount} dups for user ${userId}`);
    }

    // 2. Cleanup Push Tokens (simple merge?)
    // The code already merges. If 'tokens' map has stale keys, we can remove them if updatedAt is old.
    // Skipping for safety unless requested specific logic.

    // 3. Cleanup Duplicate Chats (Common issue: 2 DM chats for same pair)
    // Query chats where type='direct'
    // This is hard to query without scanning all chats or having an index on participants.
    // Skipping for now to avoid massive reads.

    console.log("Cleanup complete.");
}

cleanupDuplicates();
