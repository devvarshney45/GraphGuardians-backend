import ScanHistory from "../models/scanHistory.model.js";
import Repo from "../models/repo.model.js";

// 📈 GET HISTORY
export const getScanHistory = async (req, res) => {
  try {
    const { repoId } = req.params;

    const repo = await Repo.findById(repoId);
    if (!repo || repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    const history = await ScanHistory.find({ repoId })
      .sort({ createdAt: 1 });

    res.json({
      count: history.length,
      history
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
