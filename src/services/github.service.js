import axios from "axios";

// 🔍 Extract owner/repo safely
const parseRepo = (repoUrl) => {
  try {
    const cleanUrl = repoUrl.replace(".git", "").trim();
    const parts = cleanUrl.split("github.com/")[1].split("/");

    return {
      owner: parts[0],
      repo: parts[1]
    };
  } catch {
    throw new Error("Invalid GitHub URL");
  }
};

// 📦 Fetch package.json (PRIVATE + PUBLIC SUPPORT)
export const fetchPackageJson = async (
  repoUrl,
  token = null,
  branch = "main"
) => {
  try {
    const { owner, repo } = parseRepo(repoUrl);

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/package.json?ref=${branch}`;

    const headers = {
      Accept: "application/vnd.github+json"
    };

    // 🔥 PRIVATE REPO SUPPORT
    if (token) {
      headers.Authorization = `token ${token}`;
    }

    const res = await axios.get(apiUrl, { headers });

    const content = Buffer.from(res.data.content, "base64").toString("utf-8");

    return JSON.parse(content);

  } catch (err) {
    console.log("❌ GitHub Fetch Error:", err.response?.data || err.message);

    if (err.response?.status === 404) {
      throw new Error("package.json not found in repo OR wrong branch");
    }

    if (err.response?.status === 403) {
      throw new Error("GitHub API rate limit or bad token");
    }

    if (err.response?.status === 401) {
      throw new Error("Invalid GitHub token");
    }

    throw new Error("Failed to fetch package.json");
  }
};