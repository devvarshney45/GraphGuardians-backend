import admin from "firebase-admin";
import serviceAccount from "../config/firebase.json" assert { type: "json" };

/* =========================
   🔥 INIT FIREBASE (SAFE)
========================= */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log("🔥 Firebase initialized");
}

/* =========================
   🔔 SEND NOTIFICATION
========================= */
export const sendNotification = async (tokens = [], title, body) => {
  try {
    // ⚠️ no tokens
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

    const response = await admin
      .messaging()
      .sendEachForMulticast(message);

    console.log("📲 Notification sent");
    console.log("✅ Success:", response.successCount);
    console.log("❌ Failed:", response.failureCount);

    // 🔥 optional: remove invalid tokens
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