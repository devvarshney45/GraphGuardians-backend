import admin from "firebase-admin";

/* =========================
   🔥 INIT FIREBASE (SAFE)
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

      console.log("🔥 Firebase initialized");

    } else {
      console.log("⚠️ Firebase ENV missing");
    }

  } catch (err) {
    console.log("❌ Firebase init error:", err.message);
  }
}

/* =========================
   🔔 SEND NOTIFICATION (FINAL)
========================= */
export const sendNotification = async (
  tokens = [],
  title = "Alert",
  body = "",
  extraData = {}
) => {
  try {
    if (!tokens || tokens.length === 0) {
      console.log("⚠️ No FCM tokens");
      return;
    }

    // 🔥 Ensure array
    const tokenList = Array.isArray(tokens) ? tokens : [tokens];

    const message = {
      notification: {
        title,
        body
      },

      data: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        type: "SECURITY_ALERT",
        ...Object.fromEntries(
          Object.entries(extraData).map(([k, v]) => [k, String(v)])
        )
      },

      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "security-alerts"
        }
      },

      apns: {
        payload: {
          aps: {
            sound: "default",
            contentAvailable: true
          }
        }
      },

      tokens: tokenList
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    console.log("📲 Notifications sent");
    console.log(`✅ Success: ${response.successCount}`);
    console.log(`❌ Failed: ${response.failureCount}`);

    /* =========================
       🔥 HANDLE FAILED TOKENS
    ========================= */
    if (response.failureCount > 0) {
      const invalidTokens = [];

      response.responses.forEach((res, idx) => {
        if (!res.success) {
          const errCode = res.error?.code;

          // 🔥 detect invalid tokens
          if (
            errCode === "messaging/invalid-registration-token" ||
            errCode === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(tokenList[idx]);
          }
        }
      });

      if (invalidTokens.length) {
        console.log("⚠️ Remove invalid tokens:", invalidTokens);

        // 👉 OPTIONAL: remove from DB (recommended)
        // await User.updateMany(
        //   { fcmToken: { $in: invalidTokens } },
        //   { $unset: { fcmToken: "" } }
        // );
      }
    }

    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };

  } catch (err) {
    console.log("❌ Firebase send error:", err.message);

    return {
      success: false,
      error: err.message
    };
  }
};
