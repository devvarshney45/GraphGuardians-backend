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
      repo: parts[1],
      cleanUrl
    };
  } catch {
    throw new Error("Invalid GitHub URL");
  }
};

/* =========================
   🔐 GET HEADERS (SMART TOKEN)
========================= */
const getHeaders = (token) => {
  const finalToken = token || process.env.GITHUB_TOKEN;

  const headers = {
    Accept: "application/vnd.github+json"
  };

  if (finalToken) {
    headers.Authorization = `token ${finalToken}`;
  }

  return headers;
};

/* =========================
   📦 FETCH FILE FROM GITHUB
========================= */
const fetchFile = async (owner, repo, path, token, branch) => {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const res = await axios.get(apiUrl, {
    headers: getHeaders(token)
  });

  return res.data;
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

    const data = await fetchFile(
      owner,
      repo,
      "package.json",
      token,
      branch
    );

    if (!data.content) {
      throw new Error("Invalid file content");
    }

    const content = Buffer.from(
      data.content,
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
      throw new Error(
        "GitHub rate limit exceeded or access denied (use GitHub App / token)"
      );
    }

    if (err.response?.status === 401) {
      throw new Error("Invalid GitHub token");
    }

    throw new Error("Failed to fetch package.json");
  }
};

/* =========================
   📂 FETCH BRANCHES
========================= */
export const fetchBranches = async (repoUrl, token = null) => {
  try {
    const { owner, repo } = parseRepo(repoUrl);

    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      {
        headers: getHeaders(token)
      }
    );

    return res.data.map((b) => b.name);

  } catch (err) {
    console.log("❌ Branch fetch error:", err.message);
    throw new Error("Failed to fetch branches");
  }
};

/* =========================
   📂 FETCH FILE LIST
========================= */
export const fetchFiles = async (repoUrl, token = null, path = "") => {
  try {
    const { owner, repo } = parseRepo(repoUrl);

    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: getHeaders(token)
      }
    );

    return res.data.map((f) => ({
      name: f.name,
      type: f.type,
      path: f.path
    }));

  } catch (err) {
    console.log("❌ Files fetch error:", err.message);
    throw new Error("Failed to fetch files");
  }
};

/* =========================
   🔍 VALIDATE REPO
========================= */
export const validateRepo = async (repoUrl, token = null) => {
  try {
    const { owner, repo } = parseRepo(repoUrl);

    const res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: getHeaders(token)
      }
    );

    return {
      name: res.data.full_name,
      private: res.data.private,
      stars: res.data.stargazers_count,
      forks: res.data.forks_count,
      language: res.data.language
    };

  } catch (err) {
    console.log("❌ Repo validation error:", err.message);

    if (err.response?.status === 404) {
      throw new Error("Repository not found");
    }

    throw new Error("Failed to validate repository");
  }
};