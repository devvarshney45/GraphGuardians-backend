import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";

export const getDashboard = async (req, res) => {
  try {
    const { repoId } = req.params;

    // repo
    const repo = await Repo.findById(repoId);

    // counts
    const dependencyCount = await Dependency.countDocuments({ repoId });
    const vulnerabilities = await Vulnerability.find({ repoId });

    const vulnCount = vulnerabilities.length;

    // severity count
    let critical = 0, high = 0, medium = 0, low = 0;

    vulnerabilities.forEach(v => {
      if (v.severity === "CRITICAL") critical++;
      else if (v.severity === "HIGH") high++;
      else if (v.severity === "MEDIUM") medium++;
      else low++;
    });

    // risk score logic
    let riskScore = 1;
    vulnerabilities.forEach(v => {
      if (v.severity === "CRITICAL") riskScore += 3;
      else if (v.severity === "HIGH") riskScore += 2;
      else riskScore += 1;
    });

    riskScore = Math.min(10, riskScore);

    // health %
    const health = Math.max(0, 100 - riskScore * 10);

    // recent alerts
    const alerts = await Alert.find({ repoId })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      repo: {
        id: repo._id,
        name: repo.name,
        url: repo.url
      },
      stats: {
        riskScore,
        health,
        dependencies: dependencyCount,
        vulnerabilities: vulnCount
      },
      severity: {
        critical,
        high,
        medium,
        low
      },
      alerts
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
