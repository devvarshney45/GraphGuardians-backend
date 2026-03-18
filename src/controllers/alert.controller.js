import Alert from "../models/alert.model.js";
import Repo from "../models/repo.model.js";

/* =========================
   📄 GET ALERTS
========================= */

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
      .limit(Number(limit))
      .lean();

    const total = await Alert.countDocuments(filter);

    // 🔥 unread count (NEW)
    const unread = await Alert.countDocuments({
      ...filter,
      isRead: false
    });

    res.json({
      total,
      unread, // 🔥 important for app badge
      page: Number(page),
      pages: Math.ceil(total / limit),
      alerts
    });

  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch alerts"
    });
  }
};

/* =========================
   🔔 MARK SINGLE ALERT AS READ
========================= */

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await Alert.findById(id);

    if (!alert) {
      return res.status(404).json({ msg: "Alert not found" });
    }

    // 🔐 ownership check
    const repo = await Repo.findById(alert.repoId);

    if (!repo || repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    alert.isRead = true;
    await alert.save();

    res.json({
      msg: "Alert marked as read",
      alert
    });

  } catch (err) {
    res.status(500).json({
      error: "Failed to update alert"
    });
  }
};

/* =========================
   🔔 MARK ALL ALERTS AS READ
========================= */

export const markAllAsRead = async (req, res) => {
  try {
    const { repoId } = req.query;

    if (!repoId) {
      return res.status(400).json({ msg: "repoId required" });
    }

    const repo = await Repo.findById(repoId);

    if (!repo || repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    await Alert.updateMany(
      { repoId, isRead: false },
      { isRead: true }
    );

    res.json({
      msg: "All alerts marked as read"
    });

  } catch (err) {
    res.status(500).json({
      error: "Failed to update alerts"
    });
  }
};

/* =========================
   🗑️ CLEAR ALERTS
========================= */

export const clearAlerts = async (req, res) => {
  try {
    const { repoId } = req.query;

    if (!repoId) {
      return res.status(400).json({ msg: "repoId required" });
    }

    const repo = await Repo.findById(repoId);

    if (!repo || repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    await Alert.deleteMany({ repoId });

    res.json({
      msg: "All alerts cleared"
    });

  } catch (err) {
    res.status(500).json({
      error: "Failed to clear alerts"
    });
  }
};
