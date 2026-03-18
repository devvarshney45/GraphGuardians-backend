import Alert from "../models/alert.model.js";

export const getAlerts = async (req, res) => {
  try {
    const { repoId } = req.query;

    const filter = {};

    if (repoId) {
      filter.repoId = repoId;
    }

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 }) // latest first
      .limit(50); // avoid overload

    res.json({
      count: alerts.length,
      alerts
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
