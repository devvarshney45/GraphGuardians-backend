import admin from "firebase-admin";

/* =========================
   🔥 INIT FIREBASE (ENV BASED)
========================= */
if (!admin.apps.length) {
  try {
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        })
      });

      console.log("🔥 Firebase initialized (ENV)");

    } else {
      console.log("❌ Firebase ENV variables missing");
    }

  } catch (err) {
    console.log("❌ Firebase init error:", err.message);
  }
}

/* =========================
   🔔 SEND NOTIFICATION
========================= */
export const sendNotification = async (tokens = [], title, body) => {
  try {
    if (!tokens || tokens.length === 0) {
      console.log("⚠️ No FCM tokens found");
      return;
    }

    const message = {
      notification: {
        title,
        body
      },
      tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log("📲 Notification sent");
    console.log("✅ Success:", response.successCount);
    console.log("❌ Failed:", response.failureCount);

    /* =========================
       🔥 HANDLE FAILED TOKENS
    ========================= */
    if (response.failureCount > 0) {
      const failedTokens = [];

      response.responses.forEach((res, idx) => {
        if (!res.success) {
          failedTokens.push(tokens[idx]);
        }
      });

      console.log("⚠️ Invalid tokens:", failedTokens);
    }

  } catch (err) {
    console.log("❌ Firebase error:", err.message);
  }
};
