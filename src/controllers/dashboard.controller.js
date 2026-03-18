import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";

export const getDashboard = async (req, res) => {
  try {
    const { repoId } = req.params;

    // 🔍 Repo check
    const repo = await Repo.findById(repoId).lean();
    if (!repo) {
      return res.status(404).json({ msg: "Repo not found" });
    }

    // 🔐 Ownership check
    if (repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    // ⚡ Parallel queries
    const [dependencyCount, vulnerabilities, alerts] = await Promise.all([
      Dependency.countDocuments({ repoId }),
      Vulnerability.find({ repoId }).lean(),
      Alert.find({ repoId }).sort({ createdAt: -1 }).limit(5).lean()
    ]);

    const vulnCount = vulnerabilities.length;

    // 📊 severity count
    let critical = 0, high = 0, medium = 0, low = 0;

    vulnerabilities.forEach(v => {
      if (v.severity === "CRITICAL") critical++;
      else if (v.severity === "HIGH") high++;
      else if (v.severity === "MEDIUM") medium++;
      else low++;
    });

    // 🧠 risk score
    let riskScore = (
      critical * 3 +
      high * 2 +
      medium * 1 +
      low * 0.5
    );

    riskScore = Math.min(10, Math.max(1, riskScore));

    // ❤️ health
    const health = Math.max(0, 100 - riskScore * 10);

    // 🔥 NEW: Top vulnerabilities (for UI)
    const topVulnerabilities = vulnerabilities
      .sort((a, b) => {
        const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return order[b.severity] - order[a.severity];
      })
      .slice(0, 5);

    // 🔥 NEW: trend (dummy for now, can improve)
    const riskTrend = repo.riskScore
      ? riskScore - repo.riskScore
      : 0;

    res.json({
      repo: {
        id: repo._id,
        name: repo.name,
        url: repo.url,
        status: repo.status,
        lastScanned: repo.lastScanned
      },

      stats: {
        riskScore,
        health,
        dependencies: dependencyCount,
        vulnerabilities: vulnCount,
        trend: riskTrend // 🔥 new
      },

      severity: {
        critical,
        high,
        medium,
        low
      },

      topVulnerabilities, // 🔥 new

      alerts
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
