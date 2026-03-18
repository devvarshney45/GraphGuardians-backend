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
    const { repository } = req.body;

    if (!repository) return res.sendStatus(400);

    const repoName = repository.full_name;

    const repo = await Repo.findOne({ name: repoName });

    if (!repo) return res.sendStatus(200);

    console.log("🔥 New commit detected");

    // 🔥 AUTO ANALYZE
    await analyzeRepo(
      {
        body: {
          url: repo.url,
          repoId: repo._id,
          token: repo.githubToken // optional
        },
        user: { id: repo.userId }
      },
      { json: () => {} }
    );

    res.sendStatus(200);

  } catch (err) {
    console.log("Webhook error:", err.message);
    res.sendStatus(500);
  }
};