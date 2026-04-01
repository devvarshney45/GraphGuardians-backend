import mongoose from "mongoose";
import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";

export const getDashboard = async (req, res) => {
  try {
    const { repoId } = req.params;

    const repoObjectId = new mongoose.Types.ObjectId(repoId);
    const repoIdStr = repoId.toString();

    /* =========================
       🔍 Repo check (FIXED)
    ========================= */
    const repo = await Repo.findById(repoObjectId).lean();

    if (!repo) {
      return res.status(404).json({ msg: "Repo not found" });
    }

    if (repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    /* =========================
       ⏳ SCAN NOT DONE
    ========================= */
    if (repo.status !== "scanned") {
      return res.json({
        repo: {
          id: repo._id,
          name: repo.name,
          status: repo.status,
          version: repo.scanCount || 0
        },
        stats: null,
        severity: null,
        topVulnerabilities: [],
        alerts: []
      });
    }

    const latestVersion = Number(repo.scanCount || 0);
    const prevVersion = latestVersion > 1 ? latestVersion - 1 : null;

    /* =========================
       🔥 FLEXIBLE FETCH (IMPORTANT)
    ========================= */
    const [dependencies, vulnerabilities, alerts] = await Promise.all([
      Dependency.find({
        repoId: repoIdStr,
        versionGroup: { $lte: latestVersion } // 🔥 FIX
      })
        .sort({ versionGroup: -1 })
        .limit(1000)
        .lean(),

      Vulnerability.find({
        repoId: repoIdStr,
        versionGroup: { $lte: latestVersion } // 🔥 FIX
      })
        .sort({ versionGroup: -1 })
        .limit(1000)
        .lean(),

      Alert.find({ repoId: repoIdStr })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    console.log("📦 Dependencies:", dependencies.length);
    console.log("🚨 Vulnerabilities:", vulnerabilities.length);

    /* =========================
       📊 COUNTS (SMART)
    ========================= */
    const vulnCount = vulnerabilities.length;

    let dependencyCount = dependencies.length;

    if (dependencyCount === 0 && vulnCount > 0) {
      dependencyCount = new Set(
        vulnerabilities.map(v => v.package)
      ).size;
    }

    /* =========================
       📊 SEVERITY
    ========================= */
    let critical = 0, high = 0, medium = 0, low = 0;

    for (const v of vulnerabilities) {
      if (v.severity === "CRITICAL") critical++;
      else if (v.severity === "HIGH") high++;
      else if (v.severity === "MEDIUM") medium++;
      else low++;
    }

    /* =========================
       🧠 RISK
    ========================= */
    let riskScore =
      critical * 3 +
      high * 2 +
      medium * 1 +
      low * 0.5;

    riskScore = Math.min(10, Math.max(0, Number(riskScore.toFixed(2))));

    const health = Math.max(0, 100 - riskScore * 10);

    /* =========================
       🔥 TOP VULNS
    ========================= */
    const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

    const topVulnerabilities = [...vulnerabilities]
      .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity])
      .slice(0, 5);

    /* =========================
       🔁 TREND
    ========================= */
    let trend = 0;

    if (prevVersion) {
      const prevVulns = await Vulnerability.find({
        repoId: repoIdStr,
        versionGroup: prevVersion
      }).lean();

      let prevScore = 0;

      for (const v of prevVulns) {
        if (v.severity === "CRITICAL") prevScore += 3;
        else if (v.severity === "HIGH") prevScore += 2;
        else if (v.severity === "MEDIUM") prevScore += 1;
        else prevScore += 0.5;
      }

      prevScore = Math.min(10, Math.max(0, prevScore));

      trend = Number((riskScore - prevScore).toFixed(2));
    }

    /* =========================
       🚨 SAFETY FALLBACK
    ========================= */
    if (!dependencies.length && !vulnerabilities.length) {
      console.log("⚠️ Empty dashboard → possible scan delay");
    }

    /* =========================
       📊 RESPONSE
    ========================= */
    return res.json({
      repo: {
        id: repo._id,
        name: repo.name,
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
