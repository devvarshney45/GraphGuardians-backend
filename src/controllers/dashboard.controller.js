import mongoose from "mongoose";
import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";

export const getDashboard = async (req, res) => {
  try {
    const { repoId } = req.params;

    /* =========================
       🔥 FIX 1: FORCE STRING ID
    ========================= */
    const repoIdStr = String(repoId);

    /* =========================
       🔍 Repo check
    ========================= */
    const repo = await Repo.findById(repoIdStr).lean();

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
       🚀 EARLY RETURN
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
       🔥 VERSION FIX
    ========================= */
    const latestVersion = Number(repo.scanCount || 0);
    const prevVersion = latestVersion > 1 ? latestVersion - 1 : null;

    /* =========================
       ⚡ PARALLEL FETCH (FIXED)
    ========================= */
    const [dependencies, vulnerabilities, alerts] = await Promise.all([
      Dependency.find({
        repoId: repoIdStr,                 // 🔥 FIX
        versionGroup: latestVersion        // 🔥 FIX
      }).lean(),

      Vulnerability.find({
        repoId: repoIdStr,                 // 🔥 FIX
        versionGroup: latestVersion        // 🔥 FIX
      }).lean(),

      Alert.find({ repoId: repoIdStr })    // 🔥 FIX
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
    ]);

    console.log("📦 Dependencies:", dependencies.length);
    console.log("🚨 Vulnerabilities:", vulnerabilities.length);

    /* =========================
       🔥 DEP COUNT FIX (IMPORTANT)
    ========================= */
    const vulnCount = vulnerabilities.length;

    let dependencyCount = dependencies.length;

    // 🔥 fallback (jab dependency save na ho)
    if (dependencyCount === 0 && vulnerabilities.length > 0) {
      dependencyCount = new Set(
        vulnerabilities.map(v => v.package)
      ).size;
    }

    /* =========================
       📊 SEVERITY COUNT
    ========================= */
    let critical = 0, high = 0, medium = 0, low = 0;

    for (const v of vulnerabilities) {
      if (v.severity === "CRITICAL") critical++;
      else if (v.severity === "HIGH") high++;
      else if (v.severity === "MEDIUM") medium++;
      else low++;
    }

    /* =========================
       🧠 RISK SCORE (STABLE)
    ========================= */
    let riskScore =
      critical * 3 +
      high * 2 +
      medium * 1 +
      low * 0.5;

    riskScore = Math.min(10, Math.max(0, Number(riskScore.toFixed(2))));

    /* =========================
       ❤️ HEALTH
    ========================= */
    const health = Math.max(0, 100 - riskScore * 10);

    /* =========================
       🔥 TOP VULNS (FIXED SORT)
    ========================= */
    const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

    const topVulnerabilities = [...vulnerabilities]
      .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity])
      .slice(0, 5);

    /* =========================
       🔁 TREND FIX
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
        dependencies: dependencyCount,   // 🔥 FIXED
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
