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
import { pushToNeo4j } from "../services/neo4j.service.js";
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
       OLD DATA
    ========================= */
    const oldDeps = currentVersion
      ? await Dependency.find({ repoId, versionGroup: currentVersion }).lean()
      : [];

    const oldVulns = currentVersion
      ? await Vulnerability.find({ repoId, versionGroup: currentVersion }).lean()
      : [];

    /* =========================
       FETCH package.json
    ========================= */
    const pkg = await fetchPackageJson(url, token);
    if (!pkg) {
      return response.status(400).json({
        msg: "package.json not accessible"
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
      if (!d?.name || typeof d.name !== "string") continue;

      const cleanName = d.name.toLowerCase().trim();
      const key = `${cleanName}_${newVersion}`;

      if (!seen.has(key)) {
        seen.add(key);

        uniqueDeps.push({
          repoId,
          versionGroup: newVersion,
          name: cleanName,
          version: String(d.version || "unknown"),
          cleanVersion: d.cleanVersion || "",
          type: d.type || "prod"
        });
      }
    }

    console.log(`📦 Dependencies: ${uniqueDeps.length}`);

    /* =========================
       COMPARE CHANGES
    ========================= */
    const depChanges = compareDependencies(oldDeps, uniqueDeps);

    /* =========================
       SAVE DEPENDENCIES
    ========================= */
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
      package: String(v.package || "").toLowerCase().trim(),
      version: String(v.version || ""),
      severity: String(v.severity || "unknown"),
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
      findNewVulnerabilities(oldVulns, formattedVulns),
      findFixedVulnerabilities(oldVulns, formattedVulns)
    );

    if (alerts.length > 0) await Alert.insertMany(alerts);

    /* =========================
       GRAPH + RISK
    ========================= */
    const graph = buildGraph(uniqueDeps, formattedVulns, repoId);
    const risk = calculateRisk(formattedVulns);

    /* =========================
       🔥 DEPENDENCY TREE (FINAL FIX 💀)
    ========================= */
    let cleanEdges = [];

    try {
      console.log("🌳 Generating dependency tree...");

      const tree = await getDependencyTree(url, token);

      if (tree) {
        const rawEdges = extractDependencyEdges(tree);

        cleanEdges = rawEdges
          .filter(e =>
            e &&
            typeof e.from === "string" &&
            typeof e.to === "string"
          )
          .map(e => ({
            from: e.from.toLowerCase().trim(),
            to: e.to.toLowerCase().trim()
          }));
      }

    } catch (err) {
      console.log("⚠️ Tree parsing failed:", err.message);
    }

    console.log(`🔗 Clean edges: ${cleanEdges.length}`);

    /* =========================
       🔥 CLEAN DATA (FINAL 💀)
    ========================= */
    const cleanDeps = uniqueDeps.map(d => ({
      name: d.name,
      version: d.version
    }));

    const cleanVulns = formattedVulns.map(v => ({
      package: v.package,
      id: v.cve || `${v.package}_unknown`,
      severity: v.severity
    }));

    /* =========================
       🔥 NEO4J SYNC
    ========================= */
    await pushToNeo4j(
      repoId,
      cleanDeps,
      cleanVulns,
      cleanEdges
    );

    console.log("🧠 Neo4j Sync Done ✅");

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
      graph,
      alerts
    });

  } catch (err) {
    console.log("❌ Analyze Error:", err.message);

    if (res?.status) {
      return res.status(500).json({ error: err.message });
    }
  }
};
