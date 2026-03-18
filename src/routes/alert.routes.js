import Alert from "../models/alert.model.js";

// ✅ mark as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await Alert.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true }
    );

    res.json(alert);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🗑️ clear alerts
export const clearAlerts = async (req, res) => {
  try {
    const { repoId } = req.query;

    await Alert.deleteMany({ repoId });

    res.json({ msg: "Alerts cleared" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
