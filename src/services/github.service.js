import axios from "axios";

/* =========================
   🔍 PARSE REPO
========================= */
const parseRepo = (repoUrl) => {
  try {
    const cleanUrl = repoUrl.replace(".git", "").trim();
    const parts = cleanUrl.split("github.com/")[1]?.split("/");

    if (!parts || parts.length < 2) {
      throw new Error("Invalid GitHub URL");
    }

    return {
      owner: parts[0],
      repo: parts[1]
    };
  } catch {
    throw new Error("Invalid GitHub URL");
  }
};

/* =========================
   🔐 GET HEADERS (🔥 MAIN FIX)
========================= */
const getHeaders = (token) => {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `token ${token || process.env.GITHUB_TOKEN}` // 🔥 AUTO TOKEN
  };
};

/* =========================
   📦 FETCH PACKAGE.JSON
========================= */
export const fetchPackageJson = async (
  repoUrl,
  token = null,
  branch = "main"
) => {
  try {
    const { owner, repo } = parseRepo(repoUrl);

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/package.json?ref=${branch}`;

    const res = await axios.get(apiUrl, {
      headers: getHeaders(token)
    });

    const content = Buffer.from(
      res.data.content,
      "base64"
    ).toString("utf-8");

    return JSON.parse(content);

  } catch (err) {
    console.log("❌ GitHub Fetch Error:", err.response?.data || err.message);

    /* =========================
       🎯 ERROR HANDLING
    ========================= */

    if (err.response?.status === 404) {
      throw new Error("package.json not found OR wrong branch");
    }

    if (err.response?.status === 403) {
      throw new Error("GitHub rate limit exceeded (use token)");
    }

    if (err.response?.status === 401) {
      throw new Error("Invalid GitHub token");
    }

    throw new Error("Failed to fetch package.json");
  }
};