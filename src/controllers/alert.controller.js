import mongoose from "mongoose";
import Alert from "../models/alert.model.js";
import Repo from "../models/repo.model.js";

/* =========================
   📄 GET ALERTS (FINAL FIX)
========================= */
export const getAlerts = async (req, res) => {
  try {
    const repoId = req.query.repoId || req.query.repo;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    if (!repoId || !mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({ msg: "Invalid repoId" });
    }

    const repoObjectId = new mongoose.Types.ObjectId(repoId);

    // 🔐 ownership check
    const repo = await Repo.findById(repoObjectId);

    if (!repo || repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    const filter = { repoId: repoObjectId }; // ✅ FIXED

    const skip = (page - 1) * limit;

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Alert.countDocuments(filter);

    const unread = await Alert.countDocuments({
      ...filter,
      isRead: false
    });

    res.json({
      total,
      unread,
      page,
      pages: Math.ceil(total / limit),
      alerts: alerts || []
    });

  } catch (err) {
    console.log("❌ GET ALERTS ERROR:", err.message);
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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: "Invalid alert ID" });
    }

    const alert = await Alert.findById(id);

    if (!alert) {
      return res.status(404).json({ msg: "Alert not found" });
    }

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
    console.log("❌ markAsRead error:", err.message);
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
    const repoId = req.query.repoId || req.query.repo;

    if (!repoId || !mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({ msg: "Invalid repoId" });
    }

    const repoObjectId = new mongoose.Types.ObjectId(repoId);

    const repo = await Repo.findById(repoObjectId);

    if (!repo || repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    await Alert.updateMany(
      { repoId: repoObjectId, isRead: false }, // ✅ FIXED
      { isRead: true }
    );

    res.json({
      msg: "All alerts marked as read"
    });

  } catch (err) {
    console.log("❌ markAllAsRead error:", err.message);
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
    const repoId = req.query.repoId || req.query.repo;

    if (!repoId || !mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({ msg: "Invalid repoId" });
    }

    const repoObjectId = new mongoose.Types.ObjectId(repoId);

    const repo = await Repo.findById(repoObjectId);

    if (!repo || repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    await Alert.deleteMany({ repoId: repoObjectId }); // ✅ FIXED

    res.json({
      msg: "All alerts cleared"
    });

  } catch (err) {
    console.log("❌ clearAlerts error:", err.message);
    res.status(500).json({
      error: "Failed to clear alerts"
    });
  }
};
