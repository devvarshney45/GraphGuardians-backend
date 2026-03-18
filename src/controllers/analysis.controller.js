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

    const currentVersion = repo.scanCount || 0;
    const newVersion = currentVersion + 1;

    /* =========================
       🔥 START LOG
    ========================= */
    console.log("\n🚀 ===============================");
    console.log(`📦 Repo: ${repo.name}`);
    console.log(`🔢 Version: ${currentVersion} → ${newVersion}`);
    console.log("==================================");

    /* =========================
       OLD DATA
    ========================= */
    const oldDeps = currentVersion
      ? await Dependency.find({ repoId, versionGroup: currentVersion }).lean()
      : [];

    const oldVulns = currentVersion
      ? await Vulnerability.find({ repoId, versionGroup: currentVersion }).lean()
      : [];

    /* =========================
       FETCH PACKAGE.JSON
    ========================= */
    const pkg = await fetchPackageJson(url, token);

    if (!pkg) {
      return res.status(400).json({
        msg: "package.json not accessible"
      });
    }

    console.log("📥 package.json fetched");

    /* =========================
       EXTRACT DEPENDENCIES
    ========================= */
    let deps = extractDependencies(pkg);

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

    console.log(`📦 Dependencies: ${uniqueDeps.length}`);

    /* =========================
       COMPARE
    ========================= */
    const depChanges = compareDependencies(oldDeps, uniqueDeps);

    console.log("🔄 Changes:");
    console.log(`➕ Added: ${depChanges.added.length}`);
    console.log(`❌ Removed: ${depChanges.removed.length}`);
    console.log(`♻️ Updated: ${depChanges.updated.length}`);

    depChanges.updated.forEach(d => {
      console.log(`   🔁 ${d.name}: ${d.oldVersion} → ${d.newVersion}`);
    });

    /* =========================
       SAVE DEPENDENCIES
    ========================= */
    await Dependency.insertMany(uniqueDeps, { ordered: false });

    /* =========================
       VULNERABILITIES
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

    await Vulnerability.insertMany(formattedVulns, { ordered: false });

    console.log(`🚨 Vulnerabilities: ${formattedVulns.length}`);

    /* =========================
       DIFF VULNS
    ========================= */
    const newVulns = findNewVulnerabilities(oldVulns, formattedVulns);
    const fixedVulns = findFixedVulnerabilities(oldVulns, formattedVulns);

    /* =========================
       ALERTS
    ========================= */
    const alerts = generateAlerts(repoId, newVulns, fixedVulns);

    if (alerts.length > 0) {
      await Alert.insertMany(alerts);
      console.log(`🔔 Alerts: ${alerts.length}`);
    } else {
      console.log("✅ No new alerts");
    }

    /* =========================
       GRAPH + RISK + AI
    ========================= */
    const graph = buildGraph(uniqueDeps, formattedVulns, repoId);
    const risk = calculateRisk(formattedVulns);
    const aiInsights = await generateAIInsights(formattedVulns);

    console.log(`⚠️ Risk Score: ${risk}`);

    /* =========================
       TIGERGRAPH
    ========================= */
    await pushToTigerGraph(repoId, uniqueDeps, formattedVulns);

    /* =========================
       SCAN HISTORY
    ========================= */
    await ScanHistory.create({
      repoId,
      version: newVersion,
      riskScore: risk,
      dependencyCount: uniqueDeps.length,
      vulnerabilityCount: formattedVulns.length
    });

    /* =========================
       UPDATE REPO
    ========================= */
    const updatedRepo = await Repo.findByIdAndUpdate(
      repoId,
      {
        scanCount: newVersion,
        riskScore: risk,
        dependencyCount: uniqueDeps.length,
        vulnerabilityCount: formattedVulns.length,
        lastScanned: new Date(),
        status: "scanned"
      },
      { new: true }
    ).lean();

    /* =========================
       FINAL LOG
    ========================= */
    console.log("📊 Scan Completed ✅");
    console.log("==================================\n");

    /* =========================
       RESPONSE
    ========================= */
    res.json({
      version: newVersion,
      scanCount: updatedRepo.scanCount,
      repo: {
        id: updatedRepo._id,
        name: updatedRepo.name,
        url: updatedRepo.url,
        lastScanned: updatedRepo.lastScanned,
        status: updatedRepo.status
      },
      stats: {
        riskScore: risk,
        dependencies: uniqueDeps.length,
        vulnerabilities: formattedVulns.length
      },
      changes: depChanges,
      dependencies: uniqueDeps,
      vulnerabilities: formattedVulns,
      graph,
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