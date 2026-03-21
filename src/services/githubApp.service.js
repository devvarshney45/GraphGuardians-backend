import jwt from "jsonwebtoken";
import axios from "axios";

/* =========================
   🔐 APP JWT (FIXED)
========================= */
export const generateAppJWT = () => {
  try {
    const privateKey = process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n"); // 🔥 FIX

    const payload = {
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + 600,
      iss: process.env.GITHUB_APP_ID
    };

    const token = jwt.sign(payload, privateKey, {
      algorithm: "RS256"
    });

    console.log("🔐 App JWT generated");

    return token;

  } catch (err) {
    console.log("❌ JWT ERROR:", err.message);
    throw err;
  }
};

/* =========================
   🔑 INSTALLATION TOKEN (FIXED)
========================= */
export const getInstallationToken = async (installationId) => {
  try {
    if (!installationId) {
      throw new Error("Missing installationId");
    }

    console.log("🆔 Using installationId:", installationId);

    const appJWT = generateAppJWT();

    const res = await axios.post(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {},
      {
        headers: {
          Authorization: `Bearer ${appJWT}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );

    console.log("✅ Installation token generated");

    return res.data.token;

  } catch (err) {
    console.log(
      "❌ INSTALL TOKEN ERROR:",
      err.response?.data || err.message
    );
    throw err;
  }
};
