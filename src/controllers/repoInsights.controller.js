import ScanHistory from "../models/scanHistory.model.js";
import Vulnerability from "../models/vulnerability.model.js";

/* =========================
   📊 GET REPO HISTORY (GRAPH)
   /api/repos/:repoId/history
========================= */
export const getRepoHistory = async (req, res) => {
  try {
    const { repoId } = req.params;

    const history = await ScanHistory.find({ repoId })
      .sort({ version: 1 })
      .lean();

    res.json({
      count: history.length,
      history
    });

  } catch (err) {
    console.log("❌ History error:", err.message);

    res.status(500).json({
      error: "Failed to fetch history"
    });
  }
};

/* =========================
   📌 GET LATEST SCAN
   /api/repos/:repoId/latest
========================= */
export const getLatestScan = async (req, res) => {
  try {
    const { repoId } = req.params;

    const latest = await ScanHistory.findOne({ repoId })
      .sort({ version: -1 })
      .lean();

    if (!latest) {
      return res.status(404).json({
        msg: "No scan history found"
      });
    }

    res.json({
      version: latest.version,
      riskScore: latest.riskScore,
      dependencyCount: latest.dependencyCount,
      vulnerabilityCount: latest.vulnerabilityCount
    });

  } catch (err) {
    console.log("❌ Latest scan error:", err.message);

    res.status(500).json({
      error: "Failed to fetch latest scan"
    });
  }
};

/* =========================
   🔄 GET DIFF (OLD vs NEW)
   /api/repos/:repoId/diff/:version
========================= */
export const getRepoDiff = async (req, res) => {
  try {
    const { repoId, version } = req.params;

    const currentVersion = parseInt(version);
    const prevVersion = currentVersion - 1;

    if (currentVersion <= 1) {
      return res.json({
        msg: "No previous version to compare",
        newVulnerabilities: [],
        fixedVulnerabilities: []
      });
    }

    /* =========================
       FETCH DATA
    ========================= */
    const currentVulns = await Vulnerability.find({
      repoId,
      versionGroup: currentVersion
    }).lean();

    const prevVulns = await Vulnerability.find({
      repoId,
      versionGroup: prevVersion
    }).lean();

    /* =========================
       CREATE MAPS
    ========================= */
    const currentSet = new Set(
      currentVulns.map(v => `${v.package}@${v.version}`)
    );

    const prevSet = new Set(
      prevVulns.map(v => `${v.package}@${v.version}`)
    );

    /* =========================
       FIND NEW
    ========================= */
    const newVulnerabilities = currentVulns.filter(
      v => !prevSet.has(`${v.package}@${v.version}`)
    );

    /* =========================
       FIND FIXED
    ========================= */
    const fixedVulnerabilities = prevVulns.filter(
      v => !currentSet.has(`${v.package}@${v.version}`)
    );

    res.json({
      version: currentVersion,
      previousVersion: prevVersion,
      summary: {
        newCount: newVulnerabilities.length,
        fixedCount: fixedVulnerabilities.length
      },
      newVulnerabilities,
      fixedVulnerabilities
    });

  } catch (err) {
    console.log("❌ Diff error:", err.message);

    res.status(500).json({
      error: "Failed to fetch diff"
    });
  }
};