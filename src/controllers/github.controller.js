import axios from "axios";

/**
 * 🔍 Validate GitHub Repo + Fetch Basic Info
 * POST /api/github/validate
 */
export const validateRepo = async (req, res) => {
  try {
    const { url, token } = req.body;

    if (!url) {
      return res.status(400).json({ msg: "Repo URL required" });
    }

    // extract owner/repo
    const parts = url.split("github.com/")[1]?.split("/");
    if (!parts || parts.length < 2) {
      return res.status(400).json({ msg: "Invalid GitHub URL" });
    }

    const owner = parts[0];
    const repo = parts[1];

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    const headers = token
      ? { Authorization: `token ${token}` }
      : {};

    const response = await axios.get(apiUrl, { headers });

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


/**
 * 📂 Get Repository Contents (root files)
 * GET /api/github/files?url=
 */
export const getRepoFiles = async (req, res) => {
  try {
    const { url, token } = req.query;

    const parts = url.split("github.com/")[1].split("/");
    const owner = parts[0];
    const repo = parts[1];

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;

    const headers = token
      ? { Authorization: `token ${token}` }
      : {};

    const response = await axios.get(apiUrl, { headers });

    res.json({
      files: response.data.map(file => ({
        name: file.name,
        type: file.type,
        path: file.path
      }))
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * 🌿 Get Branches
 * GET /api/github/branches?url=
 */
export const getBranches = async (req, res) => {
  try {
    const { url, token } = req.query;

    const parts = url.split("github.com/")[1].split("/");
    const owner = parts[0];
    const repo = parts[1];

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/branches`;

    const headers = token
      ? { Authorization: `token ${token}` }
      : {};

    const response = await axios.get(apiUrl, { headers });

    res.json({
      branches: response.data.map(b => ({
        name: b.name
      }))
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/**
 * 📄 Get package.json directly
 * GET /api/github/package?url=
 */
export const getPackageJson = async (req, res) => {
  try {
    const { url, token } = req.query;

    const parts = url.split("github.com/")[1].split("/");
    const owner = parts[0];
    const repo = parts[1];

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/package.json`;

    const headers = token
      ? { Authorization: `token ${token}` }
      : {};

    const response = await axios.get(apiUrl, { headers });

    const content = Buffer.from(response.data.content, "base64").toString("utf-8");

    res.json({
      packageJson: JSON.parse(content)
    });

  } catch (err) {
    res.status(500).json({ error: "package.json not found" });
  }
};
