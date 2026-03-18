import Commit from "../models/commit.model.js";
import Repo from "../models/repo.model.js";
import { analyzeRepo } from "./analysis.controller.js";

// 📥 GET COMMITS (repo wise)
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

// 🔁 GITHUB WEBHOOK (REAL-TIME 🔥)
export const githubWebhook = async (req, res) => {
  try {
    const { repository, commits } = req.body;

    if (!repository) return res.sendStatus(400);

    const repoName = repository.full_name;

    // repo find karo DB me
    const repo = await Repo.findOne({ name: repoName });

    if (!repo) return res.sendStatus(200); // ignore if not tracked

    // commits save karo
    const commitData = commits.map(c => ({
      repoId: repo._id,
      message: c.message,
      hash: c.id
    }));

    await Commit.insertMany(commitData);

    console.log("New commits saved:", commitData.length);

    // 🔥 AUTO RE-ANALYZE (IMPORTANT)
    await analyzeRepo({
      body: { url: repo.url, repoId: repo._id }
    }, {
      json: () => {} // dummy response
    });

    res.sendStatus(200);

  } catch (err) {
    console.log(err.message);
    res.sendStatus(500);
  }
};
