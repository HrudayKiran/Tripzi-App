const {admin} = require("./_admin_init");

async function snapshotSchema() {
  const db = admin.firestore();
  const collections = await db.listCollections();
  const rows = [];

  for (const collection of collections) {
    const sampleSnapshot = await collection.limit(1).get();
    const countAggregate = await db.collection(collection.id).count().get();
    const count = countAggregate.data().count;
    const fields = sampleSnapshot.empty ?
      [] :
      Object.keys(sampleSnapshot.docs[0].data()).sort();

    rows.push({
      collection: collection.id,
      count,
      fields,
    });
  }

  rows.sort((a, b) => a.collection.localeCompare(b.collection));

  for (const row of rows) {
    console.log(
      `${row.collection}\tcount=${row.count}\tfields=${row.fields.join(",")}`
    );
  }
}

snapshotSchema().catch((error) => {
  console.error("[SchemaSnapshot] Failed:", error);
  process.exit(1);
});
