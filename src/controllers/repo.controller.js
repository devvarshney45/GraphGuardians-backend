import Repo from "../models/repo.model.js";
import axios from "axios";

// ➕ ADD REPO
export const addRepo = async (req, res) => {
  try {
    const { url } = req.body;
    const userId = req.user?.id; // from auth middleware

    if (!url) {
      return res.status(400).json({ msg: "Repo URL required" });
    }

    // extract owner/repo
    const parts = url.split("github.com/")[1]?.split("/");
    if (!parts || parts.length < 2) {
      return res.status(400).json({ msg: "Invalid GitHub URL" });
    }

    const owner = parts[0];
    const repoName = parts[1];

    // 🔍 Validate repo via GitHub API
    const apiUrl = `https://api.github.com/repos/${owner}/${repoName}`;

    let repoData;
    try {
      const response = await axios.get(apiUrl);
      repoData = response.data;
    } catch {
      return res.status(404).json({ msg: "Repository not found" });
    }

    // ❌ duplicate check
    const existing = await Repo.findOne({ url, userId });
    if (existing) {
      return res.status(400).json({ msg: "Repo already added" });
    }

    // ✅ create repo
    const repo = await Repo.create({
      userId,
      name: repoData.full_name,
      url,
      riskScore: 0
    });

    res.json({
      msg: "Repo added successfully",
      repo
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 📂 GET USER REPOS
export const getRepos = async (req, res) => {
  try {
    const userId = req.user?.id;

    const repos = await Repo.find({ userId })
      .sort({ createdAt: -1 });

    res.json({
      count: repos.length,
      repos
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
