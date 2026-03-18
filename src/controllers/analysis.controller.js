import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";
import ScanHistory from "../models/scanHistory.model.js"; // 🔥 NEW

import { fetchPackageJson } from "../services/github.service.js";
import { extractDependencies } from "../utils/parser.util.js";
import { checkVulnerabilities } from "../services/vulnerability.service.js";
import { buildGraph } from "../utils/graph.util.js";
import { calculateRisk } from "../utils/risk.util.js";
import { pushToTigerGraph } from "../services/tigergraph.service.js";
import { generateAIInsights } from "../services/ai.service.js";

import {
  compareDependencies,
  findNewVulnerabilities,
  findFixedVulnerabilities,
  generateAlerts
} from "../utils/diff.util.js";

export const analyzeRepo = async (req, res) => {
  try {
    const { url, repoId, token } = req.body;

    /* =========================
       🔐 Repo check
    ========================= */
    const repo = await Repo.findById(repoId);
    if (!repo) return res.status(404).json({ msg: "Repo not found" });

    if (repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    /* =========================
       🔥 VERSION SYSTEM
    ========================= */
    const currentVersion = repo.scanCount || 0;
    const newVersion = currentVersion + 1;

    /* =========================
       🔁 OLD DATA (PREVIOUS VERSION)
    ========================= */
    const oldDeps = await Dependency.find({
      repoId,
      versionGroup: currentVersion
    }).lean();

    const oldVulns = await Vulnerability.find({
      repoId,
      versionGroup: currentVersion
    }).lean();

    /* =========================
       1️⃣ Fetch package.json
    ========================= */
    const pkg = await fetchPackageJson(url, token);

    if (!pkg) {
      return res.status(400).json({
        msg: "package.json not accessible"
      });
    }

    /* =========================
       2️⃣ Extract dependencies
    ========================= */
    let deps = extractDependencies(pkg);

    // 🔥 REMOVE DUPLICATES (VERY IMPORTANT)
    deps = Array.from(
      new Map(deps.map(d => [d.name, d])).values()
    );

    /* =========================
       3️⃣ Compare dependencies
    ========================= */
    const depChanges = compareDependencies(oldDeps, deps);

    /* =========================
       4️⃣ SAVE DEPENDENCIES (VERSIONED)
    ========================= */
    await Dependency.insertMany(
      deps.map(d => ({
        repoId,
        versionGroup: newVersion,
        name: d.name,
        version: d.version,
        cleanVersion: d.cleanVersion,
        type: d.type
      })),
      { ordered: false } // 🔥 prevents duplicate crash
    );

    /* =========================
       5️⃣ Vulnerabilities (VERSIONED)
    ========================= */
    const vulns = await checkVulnerabilities(deps);

    await Vulnerability.insertMany(
      vulns.map(v => ({
        repoId,
        versionGroup: newVersion, // 🔥 IMPORTANT
        package: v.package,
        version: v.version,
        severity: v.severity,
        description: v.description,
        cve: v.cve,
        fix: v.fix
      })),
      { ordered: false }
    );

    /* =========================
       6️⃣ Diff vulnerabilities
    ========================= */
    const newVulns = findNewVulnerabilities(oldVulns, vulns);
    const fixedVulns = findFixedVulnerabilities(oldVulns, vulns);

    /* =========================
       7️⃣ Alerts
    ========================= */
    const alerts = generateAlerts(repoId, newVulns, fixedVulns);

    if (alerts.length > 0) {
      await Alert.insertMany(alerts);
    }

    /* =========================
       8️⃣ Graph
    ========================= */
    const graph = buildGraph(deps, vulns, repoId);

    /* =========================
       9️⃣ Risk
    ========================= */
    const risk = calculateRisk(vulns);

    /* =========================
       🔟 AI Insights
    ========================= */
    const aiInsights = await generateAIInsights(vulns);

    /* =========================
       1️⃣1️⃣ TigerGraph Sync
    ========================= */
    await pushToTigerGraph(repoId, deps, vulns);

    /* =========================
       1️⃣2️⃣ SAVE SCAN HISTORY 🔥
    ========================= */
    await ScanHistory.create({
      repoId,
      version: newVersion,
      riskScore: risk,
      dependencyCount: deps.length,
      vulnerabilityCount: vulns.length
    });

    /* =========================
       1️⃣3️⃣ UPDATE REPO
    ========================= */
    await Repo.findByIdAndUpdate(repoId, {
      scanCount: newVersion,
      riskScore: risk,
      dependencyCount: deps.length,
      vulnerabilityCount: vulns.length,
      lastScanned: new Date(),
      status: "scanned"
    });

    /* =========================
       RESPONSE
    ========================= */
    res.json({
      version: newVersion,
      dependencies: deps,
      vulnerabilities: vulns,
      changes: depChanges,
      graph,
      riskScore: risk,
      aiInsights,
      alerts
    });

  } catch (err) {
    console.log("❌ Analyze Error:", err.message);

    res.status(500).json({
      error: err.message
    });
  }
};