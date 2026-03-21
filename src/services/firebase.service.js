import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/* =========================
   🔥 FIX __dirname (ESM)
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================
   🔥 LOAD FIREBASE JSON (FIXED 💀)
========================= */
let serviceAccount = null;

try {
  const filePath = path.join(__dirname, "../config/firebase.json");

  const raw = fs.readFileSync(filePath, "utf-8");
  serviceAccount = JSON.parse(raw);

  console.log("🔥 Firebase JSON loaded");

} catch (err) {
  console.log("❌ Firebase JSON load failed:", err.message);
}

/* =========================
   🔥 INIT FIREBASE
========================= */
if (!admin.apps.length && serviceAccount) {
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

    /* =========================
       🔥 REMOVE INVALID TOKENS
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
