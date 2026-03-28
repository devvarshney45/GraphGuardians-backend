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

import { getDependencyTree } from "../services/dependencyTree.service.js";
import { extractDependencyEdges } from "../utils/treeParser.util.js";

import {
  compareDependencies,
  findNewVulnerabilities,
  findFixedVulnerabilities,
  generateAlerts
} from "../utils/diff.util.js";

export const analyzeRepo = async (req, res) => {
  try {
    const safeRes = {
      status: () => safeRes,
      json: () => {}
    };

    const response = res?.status ? res : safeRes;

    const { url, repoId, token } = req.body;

    /* =========================
       🔐 Repo validation
    ========================= */
    const repo = await Repo.findById(repoId);
    if (!repo) return response.status(404).json({ msg: "Repo not found" });

    if (repo.userId.toString() !== req.user.id) {
      return response.status(403).json({ msg: "Unauthorized" });
    }

    const currentVersion = repo.scanCount || 0;
    const newVersion = currentVersion + 1;

    console.log("\n🚀 ===============================");
    console.log(`📦 Repo: ${repo.name}`);
    console.log(`🔢 Version: ${currentVersion} → ${newVersion}`);
    console.log("==================================");

    /* =========================
       FETCH package.json
    ========================= */
    const pkg = await fetchPackageJson(url, token);

    if (!pkg) {
      console.log("⚠️ No package.json → skipping graph");

      return response.status(200).json({
        msg: "No package.json found",
        dependencies: [],
        vulnerabilities: []
      });
    }

    console.log("📥 package.json fetched");

    /* =========================
       EXTRACT DEPENDENCIES
    ========================= */
    const rawDeps = extractDependencies(pkg);

    const seen = new Set();
    const uniqueDeps = [];

    for (const d of rawDeps) {
      if (!d.name) continue;

      const cleanName = d.name.toLowerCase().trim();
      const key = `${cleanName}_${newVersion}`;

      if (!seen.has(key)) {
        seen.add(key);

        uniqueDeps.push({
          repoId,
          versionGroup: newVersion,
          name: cleanName,
          version: d.version || "unknown",
          cleanVersion: d.cleanVersion || "",
          type: d.type || "prod"
        });
      }
    }

    console.log(`📦 Dependencies: ${uniqueDeps.length}`);

    if (uniqueDeps.length > 0) {
      await Dependency.insertMany(uniqueDeps, { ordered: false });
    }

    /* =========================
       VULNERABILITIES
    ========================= */
    const vulns = await checkVulnerabilities(uniqueDeps);

    const formattedVulns = vulns.map(v => ({
      repoId,
      versionGroup: newVersion,
      package: v.package?.toLowerCase().trim(),
      version: v.version,
      severity: v.severity || "unknown",
      description: v.description,
      cve: v.cve,
      fix: v.fix
    }));

    if (formattedVulns.length > 0) {
      await Vulnerability.insertMany(formattedVulns, { ordered: false });
    }

    console.log(`🚨 Vulnerabilities: ${formattedVulns.length}`);

    /* =========================
       ALERTS
    ========================= */
    const alerts = generateAlerts(
      repoId,
      findNewVulnerabilities([], formattedVulns),
      findFixedVulnerabilities([], formattedVulns)
    );

    if (alerts.length > 0) {
      await Alert.insertMany(alerts);
      console.log(`🔔 Alerts: ${alerts.length}`);
    }

    /* =========================
       GRAPH + RISK
    ========================= */
    const graph = buildGraph(uniqueDeps, formattedVulns, repoId);
    const risk = calculateRisk(formattedVulns);

    console.log(`⚠️ Risk Score: ${risk}`);

    /* =========================
       AI
    ========================= */
    let aiInsights = [];
    try {
      aiInsights = await generateAIInsights(formattedVulns);
    } catch (err) {
      console.log("⚠️ AI failed:", err.message);
    }

    /* =========================
       TIGERGRAPH SYNC (SAFE)
    ========================= */
    try {
      if (!uniqueDeps.length) {
        console.log("⛔ Skipping TigerGraph (no dependencies)");
      } else if (!process.env.TG_TOKEN) {
        console.log("❌ TG_TOKEN missing → skip");
      } else {
        console.log("🧠 TigerGraph Sync Start");

        await pushToTigerGraph(
          repoId,
          uniqueDeps,
          formattedVulns
        );

        console.log("🧠 TigerGraph Sync Done ✅");
      }
    } catch (err) {
      console.log("⚠️ TigerGraph error:", err.message);
    }

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
      { returnDocument: "after" }
    ).lean();

    console.log("📊 Scan Completed ✅");
    console.log("==================================\n");

    return response.json({
      version: newVersion,
      repo: updatedRepo,
      stats: {
        riskScore: risk,
        dependencies: uniqueDeps.length,
        vulnerabilities: formattedVulns.length
      },
      dependencies: uniqueDeps,
      vulnerabilities: formattedVulns,
      graph,
      aiInsights,
      alerts
    });

  } catch (err) {
    console.log("❌ Analyze Error:", err.message);

    if (res?.status) {
      return res.status(500).json({
        error: err.message
      });
    }
  }
};
