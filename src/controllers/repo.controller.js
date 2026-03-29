import Repo from "../models/repo.model.js";
import User from "../models/user.model.js";
import axios from "axios";
import { analyzeRepo } from "./analysis.controller.js";
import { getInstallationToken } from "../services/githubApp.service.js";

/* ========================= HELPERS ========================= */
const normalizeUrl = (url) => url.replace(".git", "").trim();

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

const getHeaders = (token, isAppToken = false) => ({
  Accept: "application/vnd.github+json",
  Authorization: isAppToken
    ? `Bearer ${token}`
    : `token ${token}`
});

/* ========================= WEBHOOK ========================= */
const createWebhook = async (owner, repo, token, isAppToken) => {
  try {
    const webhookUrl = `${process.env.BASE_URL}/api/github/webhook`;

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
      { headers: getHeaders(token, isAppToken) }
    );

    console.log("✅ Webhook created");
  } catch (err) {
    if (err.response?.status === 422) {
      console.log("⚠️ Webhook already exists");
      return;
    }

    console.log("❌ Webhook error:", err.response?.data || err.message);
  }
};

/* ========================= ADD REPO ========================= */
export const addRepo = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ msg: "Repo URL required" });
    }

    const userId = req.user?._id?.toString();
    if (!userId) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const { owner, repo, cleanUrl } = parseRepo(url);

    let token = null;
    let isAppToken = false;

    /* ========================= TOKEN FETCH ========================= */
    const fullUser = await User.findById(userId);

    if (fullUser?.installationId) {
      try {
        token = await getInstallationToken(fullUser.installationId);
        isAppToken = true;
      } catch (err) {
        console.log("⚠️ Installation token error:", err.message);
      }
    }

    if (!token && fullUser?.githubAccessToken) {
      token = fullUser.githubAccessToken;
    }

    if (!token) {
      return res.status(401).json({ msg: "GitHub not connected" });
    }

    /* ========================= 🔥 FIX START ========================= */
    const existing = await Repo.findOne({ url: cleanUrl, userId });

    if (existing) {
      console.log("♻️ Repo already exists → reuse");

      // 🔥 OPTIONAL: trigger rescan (best UX)
      setImmediate(() => {
        analyzeRepo(
          {
            body: {
              url: cleanUrl,
              repoId: existing._id,
              token
            },
            user: { id: userId },
            app: req.app
          },
          { json: () => {} }
        );
      });

      return res.status(200).json({
        repo: existing,
        alreadyExists: true,
        msg: "Repo already exists, opening dashboard"
      });
    }
    /* ========================= 🔥 FIX END ========================= */

    /* ========================= FETCH REPO ========================= */
    const repoData = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: getHeaders(token, isAppToken) }
    );

    const newRepo = await Repo.create({
      userId,
      name: repoData.data.full_name,
      url: cleanUrl,
      isPrivate: repoData.data.private,
      stars: repoData.data.stargazers_count,
      forks: repoData.data.forks_count,
      language: repoData.data.language,
      status: "scanning"
    });

    /* ========================= WEBHOOK ========================= */
    createWebhook(owner, repo, token, isAppToken).catch(() => {});

    /* ========================= RESPONSE ========================= */
    res.status(201).json({
      repo: newRepo,
      alreadyExists: false
    });

    /* ========================= BACKGROUND SCAN ========================= */
    setImmediate(() => {
      analyzeRepo(
        {
          body: {
            url: cleanUrl,
            repoId: newRepo._id,
            token
          },
          user: { id: userId },
          app: req.app
        },
        { json: () => {} }
      );
    });

  } catch (err) {
    console.log("❌ Add repo error:", err.message);

    if (err.message === "Invalid GitHub URL") {
      return res.status(400).json({ msg: err.message });
    }

    res.status(500).json({ error: "Failed to add repo" });
  }
};

/* ========================= GET ALL REPOS ========================= */
export const getRepos = async (req, res) => {
  try {
    const userId = req.user._id;

    const repos = await Repo.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json(repos);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch repos" });
  }
};

/* ========================= GET SINGLE REPO ========================= */
export const getRepoById = async (req, res) => {
  try {
    const { repoId } = req.params;

    const repo = await Repo.findById(repoId);

    if (!repo) {
      return res.status(404).json({ msg: "Repo not found" });
    }

    res.json(repo);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch repo" });
  }
};

/* ========================= DELETE REPO ========================= */
export const deleteRepo = async (req, res) => {
  try {
    const { repoId } = req.params;

    const repo = await Repo.findById(repoId);

    if (!repo) {
      return res.status(404).json({ msg: "Repo not found" });
    }

    if (repo.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    await Repo.findByIdAndDelete(repoId);

    res.json({ msg: "Repo deleted successfully" });

  } catch (err) {
    console.log("❌ Delete repo error:", err.message);
    res.status(500).json({ error: "Failed to delete repo" });
  }
};

/* ========================= GET REPO DIFF ========================= */
export const getRepoDiff = async (req, res) => {
  try {
    const { repoId } = req.params;

    const repo = await Repo.findById(repoId);

    if (!repo) {
      return res.status(404).json({ msg: "Repo not found" });
    }

    res.json({
      message: "No comparison data yet",
      changes: [],
      added: 0,
      removed: 0
    });

  } catch (err) {
    console.log("❌ Diff error:", err.message);
    res.status(500).json({ error: "Failed to get diff" });
  }
};
