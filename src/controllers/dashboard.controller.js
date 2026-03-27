import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";

export const getDashboard = async (req, res) => {
  try {
    const { repoId } = req.params;

    /* =========================
       🔍 Repo check
    ========================= */
    const repo = await Repo.findById(repoId).lean();

    if (!repo) {
      return res.status(404).json({ msg: "Repo not found" });
    }

    /* =========================
       🔐 Ownership check
    ========================= */
    if (repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    /* =========================
       🚀 EARLY RETURN (IMPORTANT FIX)
    ========================= */
    if (repo.status !== "scanned") {
      return res.json({
        repo: {
          id: repo._id,
          name: repo.name,
          url: repo.url,
          status: repo.status,
          lastScanned: repo.lastScanned || null,
          version: repo.scanCount || 0
        },
        stats: null,
        severity: null,
        topVulnerabilities: [],
        alerts: []
      });
    }

    /* =========================
       🔥 VERSION SYSTEM
    ========================= */
    const latestVersion = repo.scanCount || 0;
    const prevVersion = latestVersion > 1 ? latestVersion - 1 : null;

    /* =========================
       ⚡ Parallel Queries
    ========================= */
    const [dependencies, vulnerabilities, alerts] = await Promise.all([
      Dependency.find({
        repoId,
        versionGroup: latestVersion
      }).lean(),

      Vulnerability.find({
        repoId,
        versionGroup: latestVersion
      }).lean(),

      Alert.find({ repoId })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    /* =========================
       🔥 FIX: DEPENDENCY COUNT LOGIC
    ========================= */
    const vulnCount = vulnerabilities.length;

    const dependencyCount =
      dependencies.length > 0
        ? dependencies.length
        : new Set(vulnerabilities.map(v => v.package)).size;

    /* =========================
       📊 Severity Count
    ========================= */
    let critical = 0, high = 0, medium = 0, low = 0;

    for (const v of vulnerabilities) {
      if (v.severity === "CRITICAL") critical++;
      else if (v.severity === "HIGH") high++;
      else if (v.severity === "MEDIUM") medium++;
      else low++;
    }

    /* =========================
       🧠 Risk Score
    ========================= */
    let riskScore =
      critical * 3 +
      high * 2 +
      medium * 1 +
      low * 0.5;

    riskScore = Math.min(10, Math.max(1, riskScore));

    /* =========================
       ❤️ Health
    ========================= */
    const health = Math.max(0, 100 - riskScore * 10);

    /* =========================
       🔥 TOP VULNERABILITIES
    ========================= */
    const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

    const topVulnerabilities = vulnerabilities
      .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity])
      .slice(0, 5);

    /* =========================
       🔁 TREND
    ========================= */
    let trend = 0;

    if (prevVersion) {
      const prevVulns = await Vulnerability.find({
        repoId,
        versionGroup: prevVersion
      }).lean();

      let prevScore = 0;

      for (const v of prevVulns) {
        if (v.severity === "CRITICAL") prevScore += 3;
        else if (v.severity === "HIGH") prevScore += 2;
        else if (v.severity === "MEDIUM") prevScore += 1;
        else prevScore += 0.5;
      }

      prevScore = Math.min(10, Math.max(1, prevScore));

      trend = riskScore - prevScore;
    }

    /* =========================
       📊 FINAL RESPONSE
    ========================= */
    return res.json({
      repo: {
        id: repo._id,
        name: repo.name,
        url: repo.url,
        status: repo.status,
        lastScanned: repo.lastScanned,
        version: latestVersion
      },

      stats: {
        riskScore,
        health,
        dependencies: dependencyCount,
        vulnerabilities: vulnCount,
        trend
      },

      severity: {
        critical,
        high,
        medium,
        low
      },

      topVulnerabilities,
      alerts
    });

  } catch (err) {
    console.log("❌ Dashboard error:", err.message);

    return res.status(500).json({
      error: "Failed to fetch dashboard"
    });
  }
};
