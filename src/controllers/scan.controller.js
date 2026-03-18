import ScanHistory from "../models/scanHistory.model.js";
import Repo from "../models/repo.model.js";

/* =========================
   📈 GET SCAN HISTORY (FULL PRO)
========================= */

export const getScanHistory = async (req, res) => {
  try {
    const { repoId } = req.params;

    /* =========================
       🔐 Repo Ownership Check
    ========================= */
    const repo = await Repo.findById(repoId);

    if (!repo || repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    /* =========================
       📊 Fetch History
    ========================= */
    const history = await ScanHistory.find({ repoId })
      .sort({ createdAt: 1 })
      .lean();

    /* =========================
       📉 Chart Data (Frontend Ready 🔥)
    ========================= */
    const chartData = history.map((h, index) => ({
      version: h.version || index + 1, // fallback
      riskScore: h.riskScore,
      vulnerabilities: h.vulnerabilityCount,
      dependencies: h.dependencyCount,
      date: h.createdAt
    }));

    /* =========================
       🆕 Latest Scan
    ========================= */
    const latest = history.length > 0 ? history[history.length - 1] : null;

    /* =========================
       🔁 Previous Scan (for compare 🔥)
    ========================= */
    const previous =
      history.length > 1 ? history[history.length - 2] : null;

    /* =========================
       📊 Response
    ========================= */
    res.json({
      count: history.length,

      latest: latest
        ? {
            version: latest.version,
            riskScore: latest.riskScore,
            vulnerabilities: latest.vulnerabilityCount,
            dependencies: latest.dependencyCount,
            date: latest.createdAt
          }
        : null,

      previous: previous
        ? {
            version: previous.version,
            riskScore: previous.riskScore,
            vulnerabilities: previous.vulnerabilityCount,
            dependencies: previous.dependencyCount,
            date: previous.createdAt
          }
        : null,

      // raw history (optional use)
      history,

      // 🔥 frontend chart ready
      chartData
    });

  } catch (err) {
    console.log("❌ Scan history error:", err.message);

    res.status(500).json({
      error: "Failed to fetch scan history"
    });
  }
};