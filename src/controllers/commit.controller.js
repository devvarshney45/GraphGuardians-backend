import Commit from "../models/commit.model.js";
import Repo from "../models/repo.model.js";

// ✅ REMOVED: githubWebhook — webhook.controller.js mein already better version hai
// ✅ REMOVED: analyzeRepo import — yahan zarurat nahi

export const getCommits = async (req, res) => {
  try {
    const { repoId } = req.params;

    // 🔐 Ownership check
    const repo = await Repo.findById(repoId);

    if (!repo) {
      return res.status(404).json({ msg: "Repo not found" });
    }

    if (repo.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    const commits = await Commit.find({ repoId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      count: commits.length,
      commits
    });

  } catch (err) {
    console.log("❌ Get commits error:", err.message);
    res.status(500).json({ error: err.message });
  }
};