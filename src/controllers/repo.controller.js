import Repo from "../models/repo.model.js";
import axios from "axios";
import { analyzeRepo } from "./analysis.controller.js";

/* =========================
   🔧 HELPERS
========================= */

const normalizeUrl = (url) => {
  return url.replace(".git", "").trim();
};

const parseRepo = (url) => {
  const cleanUrl = normalizeUrl(url);

  const parts = cleanUrl.split("github.com/")[1]?.split("/");

  if (!parts || parts.length < 2) {
    throw new Error("Invalid GitHub URL");
  }

  return {
    owner: parts[0],
    repo: parts[1],
    cleanUrl
  };
};

// 🔥 TOKEN FIX (ENV + USER)
const getHeaders = (token) => {
  return {
    Authorization: `token ${token || process.env.GITHUB_TOKEN}`
  };
};

/* =========================
   🔥 CREATE WEBHOOK (NEW)
========================= */

const createWebhook = async (owner, repo, token) => {
  try {
    const webhookUrl = `${process.env.BASE_URL}/api/commits/webhook`;

    await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      {
        name: "web",
        active: true,
        events: ["push"],
        config: {
          url: webhookUrl,
          content_type: "json"
        }
      },
      {
        headers: getHeaders(token)
      }
    );

    console.log("✅ Webhook created");

  } catch (err) {
    // ⚠️ webhook already exists ignore
    if (err.response?.status === 422) {
      console.log("⚠️ Webhook already exists");
      return;
    }

    console.log("❌ Webhook error:", err.response?.data || err.message);
  }
};

/* =========================
   ➕ ADD REPO + AUTO SCAN + WEBHOOK 🔥
========================= */

export const addRepo = async (req, res) => {
  try {
    const { url, token } = req.body;
    const userId = req.user?.id;

    if (!url) {
      return res.status(400).json({ msg: "Repo URL required" });
    }

    const { owner, repo, cleanUrl } = parseRepo(url);

    let repoData;

    try {
      const response = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}`,
        { headers: getHeaders(token) }
      );

      repoData = response.data;

    } catch (err) {
      console.log("❌ GitHub API error:", err.response?.data || err.message);
      return res.status(404).json({
        msg: "Repository not found or private"
      });
    }

    // ❌ duplicate check
    const existing = await Repo.findOne({ url: cleanUrl, userId });
    if (existing) {
      return res.status(400).json({ msg: "Repo already added" });
    }

    // ✅ create repo
    const newRepo = await Repo.create({
      userId,
      name: repoData.full_name,
      url: cleanUrl,
      isPrivate: repoData.private,
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      language: repoData.language,

      githubToken: token, // 🔥 save token

      riskScore: 0,
      status: "scanning"
    });

    /* =========================
       🔥 AUTO WEBHOOK
    ========================= */
    await createWebhook(owner, repo, token);

    /* =========================
       🔥 AUTO FIRST SCAN
    ========================= */
    try {
      await analyzeRepo(
        {
          body: {
            url: cleanUrl,
            repoId: newRepo._id,
            token
          },
          user: { id: userId }
        },
        { json: () => {} }
      );

      console.log("✅ Auto first scan completed");

    } catch (err) {
      console.log("❌ Auto scan failed:", err.message);

      await Repo.findByIdAndUpdate(newRepo._id, {
        status: "error"
      });
    }

    res.status(201).json({
      msg: "Repo added, webhook created & scanned successfully 🚀",
      repo: newRepo
    });

  } catch (err) {
    console.log("❌ Add repo error:", err.message);

    res.status(500).json({
      error: "Failed to add repo"
    });
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
    console.log("❌ Fetch repos error:", err.message);

    res.status(500).json({
      error: "Failed to fetch repos"
    });
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
    console.log("❌ Fetch repo error:", err.message);

    res.status(500).json({
      error: "Failed to fetch repo"
    });
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

    res.json({
      msg: "Repo deleted successfully"
    });

  } catch (err) {
    console.log("❌ Delete repo error:", err.message);

    res.status(500).json({
      error: "Failed to delete repo"
    });
  }
};