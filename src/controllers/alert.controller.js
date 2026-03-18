import Alert from "../models/alert.model.js";
import Repo from "../models/repo.model.js";

export const getAlerts = async (req, res) => {
  try {
    const { repoId, page = 1, limit = 20 } = req.query;

    const filter = {};

    // 🔐 repo ownership check
    if (repoId) {
      const repo = await Repo.findById(repoId);

      if (!repo || repo.userId.toString() !== req.user.id) {
        return res.status(403).json({ msg: "Unauthorized" });
      }

      filter.repoId = repoId;
    }

    const skip = (page - 1) * limit;

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Alert.countDocuments(filter);

    res.json({
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      alerts
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
