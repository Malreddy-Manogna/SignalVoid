const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.detectSilence = functions.https.onRequest(async (req, res) => {
  try {
    const now = admin.firestore.Timestamp.now();
    const fiveMinAgo = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - 5 * 60 * 1000
    );
    const thirtyFiveMinAgo = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - 2 * 60 * 1000
    );

    const snap = await db
      .collection("heartbeats")
      .where("timestamp", ">=", thirtyFiveMinAgo)
      .get();

    const recent = {};
    const baseline = {};

    snap.forEach(doc => {
      const { gridId, timestamp } = doc.data();
      if (!gridId || !timestamp) return;

      baseline[gridId] = (baseline[gridId] || 0) + 1;
      if (timestamp.toMillis() >= fiveMinAgo.toMillis()) {
        recent[gridId] = (recent[gridId] || 0) + 1;
      }
    });

    const results = {};

    Object.keys(baseline).forEach(gridId => {
      const r = recent[gridId] || 0;
      const b = baseline[gridId];
      let status = "normal";

      const ratio = b > 0 ? r / b : 0;

      if (b > 0 && r === 0) status = "silent";
      else if (ratio < 0.2) status = "silent";
      else if (ratio < 0.6) status = "reduced";

      results[gridId] = {
        status,
        recentCount: r,
        baselineCount: b
      };
    });

    res.json({
      updatedAt: new Date().toISOString(),
      grids: results
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error detecting silence");
  }
});
