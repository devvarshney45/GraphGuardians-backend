import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";
import ScanHistory from "../models/scanHistory.model.js";

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
       🔁 OLD DATA
    ========================= */
    const oldDeps = currentVersion
      ? await Dependency.find({ repoId, versionGroup: currentVersion }).lean()
      : [];

    const oldVulns = currentVersion
      ? await Vulnerability.find({ repoId, versionGroup: currentVersion }).lean()
      : [];

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

    /* =========================
       🔥 STRONG DEDUP + NORMALIZATION
    ========================= */
    const seen = new Set();
    const uniqueDeps = [];

    for (const d of deps) {
      const cleanName = d.name.toLowerCase().trim();
      const key = `${cleanName}_${newVersion}`;

      if (!seen.has(key)) {
        seen.add(key);

        uniqueDeps.push({
          repoId,
          versionGroup: newVersion,
          name: cleanName,
          version: d.version,
          cleanVersion: d.cleanVersion,
          type: d.type
        });
      }
    }

    /* =========================
       3️⃣ Compare dependencies
    ========================= */
    const depChanges = compareDependencies(oldDeps, uniqueDeps);

    /* =========================
       4️⃣ SAVE DEPENDENCIES
    ========================= */
    await Dependency.insertMany(uniqueDeps, {
      ordered: false
    });

    /* =========================
       5️⃣ Vulnerabilities
    ========================= */
    const vulns = await checkVulnerabilities(uniqueDeps);

    const formattedVulns = vulns.map(v => ({
      repoId,
      versionGroup: newVersion,
      package: v.package?.toLowerCase().trim(),
      version: v.version,
      severity: v.severity,
      description: v.description,
      cve: v.cve,
      fix: v.fix
    }));

    await Vulnerability.insertMany(formattedVulns, {
      ordered: false
    });

    /* =========================
       6️⃣ Diff vulnerabilities
    ========================= */
    const newVulns = findNewVulnerabilities(oldVulns, formattedVulns);
    const fixedVulns = findFixedVulnerabilities(oldVulns, formattedVulns);

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
    const graph = buildGraph(uniqueDeps, formattedVulns, repoId);

    /* =========================
       9️⃣ Risk
    ========================= */
    const risk = calculateRisk(formattedVulns);

    /* =========================
       🔟 AI Insights
    ========================= */
    const aiInsights = await generateAIInsights(formattedVulns);

    /* =========================
       1️⃣1️⃣ TigerGraph Sync
    ========================= */
    await pushToTigerGraph(repoId, uniqueDeps, formattedVulns);

    /* =========================
       1️⃣2️⃣ Scan History
    ========================= */
    await ScanHistory.create({
      repoId,
      version: newVersion,
      riskScore: risk,
      dependencyCount: uniqueDeps.length,
      vulnerabilityCount: formattedVulns.length
    });

    /* =========================
       1️⃣3️⃣ Update Repo
    ========================= */
    await Repo.findByIdAndUpdate(repoId, {
      scanCount: newVersion,
      riskScore: risk,
      dependencyCount: uniqueDeps.length,
      vulnerabilityCount: formattedVulns.length,
      lastScanned: new Date(),
      status: "scanned"
    });

    /* =========================
       RESPONSE
    ========================= */
    res.json({
      version: newVersion,
      dependencies: uniqueDeps,
      vulnerabilities: formattedVulns,
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