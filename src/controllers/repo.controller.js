import Repo from "../models/repo.model.js";
import axios from "axios";

/* =========================
   🔧 HELPER
========================= */

const parseRepo = (url) => {
  const parts = url.replace(".git", "").split("github.com/")[1]?.split("/");

  if (!parts || parts.length < 2) {
    throw new Error("Invalid GitHub URL");
  }

  return {
    owner: parts[0],
    repo: parts[1]
  };
};

const getHeaders = (token) => {
  return token ? { Authorization: `token ${token}` } : {};
};

/* =========================
   ➕ ADD REPO
========================= */

export const addRepo = async (req, res) => {
  try {
    const { url, token } = req.body;
    const userId = req.user?.id;

    if (!url) {
      return res.status(400).json({ msg: "Repo URL required" });
    }

    const { owner, repo } = parseRepo(url);

    let repoData;

    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers: getHeaders(token) }
      );

      repoData = response.data;

    } catch {
      return res.status(404).json({ msg: "Repository not found or private" });
    }

    // ❌ duplicate
    const existing = await Repo.findOne({ url, userId });
    if (existing) {
      return res.status(400).json({ msg: "Repo already added" });
    }

    // ✅ create
    const newRepo = await Repo.create({
      userId,
      name: repoData.full_name,
      url,
      private: repoData.private,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      language: repoData.language,
      riskScore: 0,
      status: "idle"
    });

    res.status(201).json({
      msg: "Repo added successfully",
      repo: newRepo
    });

  } catch (err) {
    res.status(500).json({ error: "Failed to add repo" });
  }
};

/* =========================
   📂 GET USER REPOS
========================= */

export const getRepos = async (req, res) => {
  try {
    const userId = req.user?.id;

    const repos = await Repo.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      count: repos.length,
      repos
    });

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch repos" });
  }
};

/* =========================
   📄 GET SINGLE REPO
========================= */

export const getRepoById = async (req, res) => {
  try {
    const { repoId } = req.params;

    const repo = await Repo.findById(repoId);

    if (!repo) {
      return res.status(404).json({ msg: "Repo not found" });
    }

    if (repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    res.json(repo);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch repo" });
  }
};

/* =========================
   🗑️ DELETE REPO
========================= */

export const deleteRepo = async (req, res) => {
  try {
    const { repoId } = req.params;

    const repo = await Repo.findById(repoId);

    if (!repo) {
      return res.status(404).json({ msg: "Repo not found" });
    }

    if (repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    await Repo.findByIdAndDelete(repoId);

    res.json({ msg: "Repo deleted successfully" });

  } catch (err) {
    res.status(500).json({ error: "Failed to delete repo" });
  }
};
