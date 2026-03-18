import axios from "axios";

/* ================================
   🔧 COMMON HELPERS (IMPORTANT)
================================ */

// 🔍 Parse repo URL safely
const parseRepo = (url) => {
  const cleanUrl = url.replace(".git", "").trim();
  const parts = cleanUrl.split("github.com/")[1]?.split("/");

  if (!parts || parts.length < 2) {
    throw new Error("Invalid GitHub URL");
  }

  return {
    owner: parts[0],
    repo: parts[1]
  };
};

// 🔐 Auth headers
const getHeaders = (token) => {
  return token
    ? { Authorization: `token ${token}` }
    : {};
};

/* ================================
   🔍 VALIDATE REPO
================================ */

export const validateRepo = async (req, res) => {
  try {
    const { url, token } = req.body;

    if (!url) {
      return res.status(400).json({ msg: "Repo URL required" });
    }

    const { owner, repo } = parseRepo(url);

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: getHeaders(token) }
    );

    res.json({
      valid: true,
      repo: {
        name: response.data.name,
        fullName: response.data.full_name,
        private: response.data.private,
        stars: response.data.stargazers_count,
        forks: response.data.forks_count,
        language: response.data.language,
        defaultBranch: response.data.default_branch
      }
    });

  } catch (err) {
    res.status(400).json({
      valid: false,
      error: "Repository not found or access denied"
    });
  }
};

/* ================================
   📂 GET FILES
================================ */

export const getRepoFiles = async (req, res) => {
  try {
    const { url, token, branch = "main" } = req.query;

    if (!url) {
      return res.status(400).json({ msg: "Repo URL required" });
    }

    const { owner, repo } = parseRepo(url);

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents?ref=${branch}`,
      { headers: getHeaders(token) }
    );

    res.json({
      files: response.data.map(file => ({
        name: file.name,
        type: file.type,
        path: file.path
      }))
    });

  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch repository files"
    });
  }
};

/* ================================
   🌿 GET BRANCHES
================================ */

export const getBranches = async (req, res) => {
  try {
    const { url, token } = req.query;

    if (!url) {
      return res.status(400).json({ msg: "Repo URL required" });
    }

    const { owner, repo } = parseRepo(url);

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
      { headers: getHeaders(token) }
    );

    res.json({
      branches: response.data.map(branch => ({
        name: branch.name
      }))
    });

  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch branches"
    });
  }
};

/* ================================
   📄 GET package.json
================================ */

export const getPackageJson = async (req, res) => {
  try {
    const { url, token, branch = "main" } = req.query;

    if (!url) {
      return res.status(400).json({ msg: "Repo URL required" });
    }

    const { owner, repo } = parseRepo(url);

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/package.json?ref=${branch}`,
      { headers: getHeaders(token) }
    );

    const content = Buffer.from(
      response.data.content,
      "base64"
    ).toString("utf-8");

    res.json({
      packageJson: JSON.parse(content)
    });

  } catch (err) {
    res.status(404).json({
      error: "package.json not found"
    });
  }
};
