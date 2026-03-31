import axios from "axios";

/* =========================
   🔧 PARSE REPO
========================= */
const parseRepo = (url) => {
  try {
    const cleanUrl = url.replace(".git", "").trim();

    const parts = cleanUrl.split("github.com/")[1]?.split("/");

    if (!parts || parts.length < 2) {
      throw new Error("Invalid GitHub URL");
    }

    return {
      owner: parts[0],
      repo: parts[1]
    };
  } catch (err) {
    console.log("❌ Repo parse failed:", err.message);
    return {};
  }
};

/* =========================
   📡 HEADERS
========================= */
const getHeaders = (token) => ({
  Accept: "application/vnd.github+json",
  ...(token && { Authorization: `token ${token}` })
});

/* =========================
   🔍 GET DEFAULT BRANCH
========================= */
const getDefaultBranch = async (owner, repo, token) => {
  try {
    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: getHeaders(token) }
    );

    return res.data.default_branch || "main";
  } catch (err) {
    console.log("⚠️ Failed to fetch default branch");
    return "main"; // fallback
  }
};

/* =========================
   📥 FETCH FILE (FINAL 🔥)
========================= */
export const fetchFileFromGitHub = async (repoUrl, filePath, token = null) => {
  try {
    const { owner, repo } = parseRepo(repoUrl);

    if (!owner || !repo) {
      console.log("❌ Invalid repo URL");
      return null;
    }

    const branch = await getDefaultBranch(owner, repo, token);

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

    const res = await axios.get(apiUrl, {
      headers: getHeaders(token),
      timeout: 10000
    });

    if (!res.data?.content) {
      console.log(`⚠️ No content in ${filePath}`);
      return null;
    }

    const content = Buffer.from(res.data.content, "base64").toString("utf-8");

    try {
      return JSON.parse(content);
    } catch {
      console.log(`⚠️ JSON parse failed for ${filePath}`);
      return null;
    }

  } catch (err) {
    const status = err.response?.status;

    if (status === 404) {
      console.log(`⚠️ ${filePath} not found`);
    } else if (status === 403) {
      console.log("🚫 GitHub rate limit / permission issue");
    } else {
      console.log(`❌ Fetch error (${filePath}):`, err.message);
    }

    return null;
  }
};
