import jwt from "jsonwebtoken";
import axios from "axios";

/* =========================
   🔐 APP JWT
========================= */
export const generateAppJWT = () => {
  return jwt.sign(
    {
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + 600,
      iss: process.env.GITHUB_APP_ID
    },
    process.env.GITHUB_PRIVATE_KEY,
    { algorithm: "RS256" }
  );
};

/* =========================
   🔑 INSTALLATION TOKEN
========================= */
export const getInstallationToken = async (installationId) => {
  const jwtToken = generateAppJWT();

  const res = await axios.post(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {},
    {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        Accept: "application/vnd.github+json"
      }
    }
  );

  return res.data.token;
};