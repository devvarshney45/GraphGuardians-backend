import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";
import ScanHistory from "../models/scanHistory.model.js";
import User from "../models/user.model.js";

import { fetchPackageJson } from "../services/github.service.js";
import { extractDependencies } from "../utils/parser.util.js";
import { checkVulnerabilities } from "../services/vulnerability.service.js";
import { calculateRisk } from "../utils/risk.util.js";
import { pushToNeo4j } from "../services/neo4j.service.js";
import { sendNotification } from "../services/firebase.service.js";

import { getDependencyTree } from "../services/dependencyTree.service.js";
import { extractDependencyEdges } from "../utils/treeParser.util.js";

import {
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
       🔐 VALIDATION
    ========================= */
    const repo = await Repo.findById(repoId);
    if (!repo) return response.status(404).json({ msg: "Repo not found" });

    if (repo.userId.toString() !== req.user.id) {
      return response.status(403).json({ msg: "Unauthorized" });
    }

    const repoIdStr = String(repoId);

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
          repoId: repoIdStr,
          versionGroup: newVersion,
          name: cleanName,
          version: String(d.version || "unknown"),
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
      repoId: repoIdStr,
      versionGroup: newVersion,
      package: String(v.package || "").toLowerCase().trim(),
      version: String(v.version || ""),
      severity: String(v.severity || "unknown"),
      cve: v.cve,
      fix: v.fix
    }));

    if (formattedVulns.length > 0) {
      await Vulnerability.insertMany(formattedVulns, { ordered: false });
    }

    console.log(`🚨 Vulnerabilities: ${formattedVulns.length}`);

    /* =========================
       🔔 ALERTS + FIREBASE DEBUG
    ========================= */
    const alerts = generateAlerts(
      repoIdStr,
      findNewVulnerabilities(oldVulns, formattedVulns),
      findFixedVulnerabilities(oldVulns, formattedVulns)
    );

    if (alerts.length > 0) {
      await Alert.insertMany(alerts);
      console.log(`🔔 Alerts: ${alerts.length}`);

      try {
        const user = await User.findById(repo.userId);

        console.log("👤 USER ID:", user?._id);
        console.log("📱 TOKENS:", user?.deviceTokens);

        const tokens = user?.deviceTokens || [];

        if (!tokens.length) {
          console.log("⚠️ No tokens found → notification skipped");
        } else {
          console.log("🚀 Sending notification...");

          await sendNotification(
            tokens,
            "🚨 Security Alert",
            `${alerts.length} new vulnerabilities detected`
          );
        }

      } catch (err) {
        console.log("❌ Firebase failed:", err.message);
      }

    } else {
      console.log("✅ No new alerts");
    }

    /* =========================
       🌳 DEPENDENCY TREE
    ========================= */
    let cleanEdges = [];

    try {
      console.log("🌳 Generating dependency tree...");

      const tree = await getDependencyTree(url, token);

      if (tree) {
        cleanEdges = extractDependencyEdges(tree)
          .filter(e => e && e.from && e.to)
          .map(e => ({
            from: String(e.from).toLowerCase().trim(),
            to: String(e.to).toLowerCase().trim()
          }));
      }

    } catch (err) {
      console.log("⚠️ Tree parsing failed:", err.message);
    }

    console.log(`🔗 Clean edges: ${cleanEdges.length}`);

    /* =========================
       🔥 NEO4J
    ========================= */
    await pushToNeo4j(
      repoIdStr,
      uniqueDeps.map(d => ({
        name: d.name,
        version: d.version
      })),
      formattedVulns.map(v => ({
        package: v.package,
        id: v.cve || `${v.package}_unknown`,
        severity: v.severity
      })),
      cleanEdges
    );

    console.log("🧠 Neo4j Sync Done ✅");

    /* =========================
       📊 HISTORY
    ========================= */
    const risk = calculateRisk(formattedVulns);

    await ScanHistory.create({
      repoId: repoIdStr,
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
      alerts
    });

  } catch (err) {
    console.log("❌ Analyze Error:", err.message);

    if (res?.status) {
      return res.status(500).json({ error: err.message });
    }
  }
};
