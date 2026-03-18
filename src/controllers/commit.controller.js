import Commit from "../models/commit.model.js";
import Repo from "../models/repo.model.js";
import { runAnalysis } from "../services/analysis.service.js";

// 📥 GET COMMITS
export const getCommits = async (req, res) => {
  try {
    const { repoId } = req.params;

    const commits = await Commit.find({ repoId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      count: commits.length,
      commits
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔁 WEBHOOK (REAL-TIME 🔥)
export const githubWebhook = async (req, res) => {
  try {
    const { repository, commits } = req.body;

    if (!repository) return res.sendStatus(400);

    const repoName = repository.full_name;

    const repo = await Repo.findOne({ name: repoName });

    if (!repo) return res.sendStatus(200);

    // 🔒 avoid duplicates
    const existingHashes = await Commit.find({
      repoId: repo._id
    }).select("hash");

    const existingSet = new Set(existingHashes.map(c => c.hash));

    const newCommits = commits
      .filter(c => !existingSet.has(c.id))
      .map(c => ({
        repoId: repo._id,
        message: c.message,
        hash: c.id
      }));

    if (newCommits.length > 0) {
      await Commit.insertMany(newCommits);
      console.log("✅ New commits saved:", newCommits.length);

      // 🔥 RE-ANALYSIS (CORRECT WAY)
      await runAnalysis(repo.url, repo._id);
    }

    res.sendStatus(200);

  } catch (err) {
    console.log("Webhook error:", err.message);
    res.sendStatus(500);
  }
};
