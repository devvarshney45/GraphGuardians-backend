import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";
import Repo from "../models/repo.model.js";
import ScanHistory from "../models/scanHistory.model.js";
import User from "../models/user.model.js";

import { fetchPackageJson } from "./github.service.js";
import { extractDependencies } from "../utils/parser.util.js";
import { checkVulnerabilities } from "./vulnerability.service.js";
import { calculateRisk } from "../utils/risk.util.js";
import { generateAIInsights } from "./ai.service.js";

import { getDependencyTree } from "./dependencyTree.service.js";
import { extractDependencyEdges } from "../utils/treeParser.util.js";

import { pushToTigerGraph } from "./tigergraph.service.js";

/* ✅ FIXED IMPORT */
import { sendNotification, writeToFirestore } from "./firebase.service.js";

import {
  compareDependencies,
  findNewVulnerabilities,
  findFixedVulnerabilities,
  generateAlerts
} from "../utils/diff.util.js";

/* ✅ FIRESTORE CLEANER */
const cleanForFirestore = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

export const runAnalysis = async (url, repoId, token) => {
  try {
    console.log("\n🚀 ===============================");

    const repo = await Repo.findById(repoId);
    if (!repo) throw new Error("Repo not found");

    const repoIdStr = String(repoId);

    const currentVersion = repo.scanCount || 0;
    const newVersion = currentVersion + 1;

    console.log(`📦 Repo: ${repo.name}`);
    console.log(`🔢 Version: ${currentVersion} → ${newVersion}`);

    /* ================= OLD DATA ================= */
    const oldDeps = currentVersion
      ? await Dependency.find({ repoId: repoIdStr, versionGroup: currentVersion }).lean()
      : [];

    const oldVulns = currentVersion
      ? await Vulnerability.find({ repoId: repoIdStr, versionGroup: currentVersion }).lean()
      : [];

    /* ================= FETCH PACKAGE ================= */
    const pkg = await fetchPackageJson(url, token);
    console.log("📥 package.json fetched");

    if (!pkg) {
      console.log("⚠️ No package.json found → skipping scan");
      return;
    }

    /* ================= EXTRACT DEPENDENCIES ================= */
    const rawDeps = extractDependencies(pkg);

    const seen = new Set();
    const uniqueDeps = [];

    for (const d of rawDeps || []) {
      if (!d?.name) continue;

      const name = d.name.toLowerCase().trim();
      const key = `${name}_${newVersion}`;

      if (!seen.has(key)) {
        seen.add(key);

        uniqueDeps.push({
          repoId: repoIdStr, // ✅ FIXED
          versionGroup: newVersion,
          name,
          version: d.version || "unknown",
          cleanVersion: d.cleanVersion || "",
          type: d.type || "prod"
        });
      }
    }

    console.log(`📦 Dependencies: ${uniqueDeps.length}`);

    /* ================= COMPARE ================= */
    const depChanges = compareDependencies(oldDeps, uniqueDeps);

    console.log(`➕ Added: ${depChanges.added.length}`);
    console.log(`❌ Removed: ${depChanges.removed.length}`);
    console.log(`♻️ Updated: ${depChanges.updated.length}`);

    if (uniqueDeps.length > 0) {
      await Dependency.insertMany(uniqueDeps, { ordered: false });
    }

    /* ================= VULNERABILITIES ================= */
    const vulns = await checkVulnerabilities(uniqueDeps);

    const formattedVulns = (vulns || []).map(v => ({
      repoId: repoIdStr,
      versionGroup: newVersion,
      package: v.package?.toLowerCase()?.trim(),
      version: v.version || "",
      severity: v.severity || "unknown",
      description: v.description || "",
      cve: v.cve || "N/A",
      fix: v.fix || "Update dependency"
    }));

    if (formattedVulns.length > 0) {
      await Vulnerability.insertMany(formattedVulns, { ordered: false });
    }

    console.log(`🚨 Vulnerabilities: ${formattedVulns.length}`);

    /* ================= ALERTS ================= */
    const newVulns = findNewVulnerabilities(oldVulns, formattedVulns);
    const fixedVulns = findFixedVulnerabilities(oldVulns, formattedVulns);

    const alerts = generateAlerts(repoIdStr, newVulns, fixedVulns);

    if (alerts.length > 0) {
      await Alert.insertMany(alerts);
      console.log(`🔔 Alerts generated: ${alerts.length}`);
    } else {
      console.log("✅ No new alerts");
    }

    /* ================= RISK ================= */
    const risk = calculateRisk(formattedVulns);
    console.log(`⚠️ Risk Score: ${risk}`);

    /* ================= AI ================= */
    let aiInsights = [];

    try {
      console.log("🧠 AI START");

      // 🔥 LIMIT TO AVOID RATE LIMIT
      aiInsights = await generateAIInsights(formattedVulns.slice(0, 15));

      console.log("✅ AI DONE");
    } catch (err) {
      console.log("⚠️ AI failed:", err.message);
    }

    /* ================= DEP TREE ================= */
    let depEdges = [];

    try {
      console.log("🌳 Generating dependency tree...");

      const tree = await getDependencyTree(url, token);

      if (tree) {
        depEdges = extractDependencyEdges(tree);
      }

    } catch (err) {
      console.log("⚠️ Tree error:", err.message);
    }

    console.log(`🔗 Dependency edges: ${depEdges.length}`);

    if (depEdges.length === 0) {
      console.log("⚠️ No chain detected → Only direct graph available");
    }

    /* ================= TIGERGRAPH ================= */
    try {
      console.log("🚀 Pushing to TigerGraph...");

      await pushToTigerGraph(
        repoIdStr,
        uniqueDeps.map(d => ({ name: d.name, version: d.version })),
        formattedVulns,
        depEdges
      );

      console.log("🧠 TigerGraph Sync Done ✅");

    } catch (err) {
      console.log("⚠️ TigerGraph error:", err.message);
    }

    /* ================= FCM ================= */
    try {
      const user = await User.findById(repo.userId);
      const tokens = user?.fcmTokens || [];

      if (tokens.length > 0 && alerts.length > 0) {
        await sendNotification(
          tokens,
          "🚨 Security Alert",
          `${alerts.length} new vulnerabilities detected in ${repo.name}`,
          { repoId: repoIdStr }
        );

        console.log(`📲 FCM sent to ${tokens.length} device(s)`);
      } else {
        console.log("📲 FCM skipped");
      }

    } catch (err) {
      console.log("❌ Notification error:", err.message);
    }

    /* ================= FIRESTORE ================= */
    try {
      await writeToFirestore(
        cleanForFirestore({
          repoId: repoIdStr,
          alerts,
          vulnerabilities: formattedVulns,
          riskScore: risk,
          version: newVersion
        })
      );

      console.log("🔥 Firestore updated");

    } catch (err) {
      console.log("❌ Firestore write failed:", err.message);
    }

    /* ================= HISTORY ================= */
    await ScanHistory.create({
      repoId: repoIdStr,
      version: newVersion,
      riskScore: risk,
      dependencyCount: uniqueDeps.length,
      vulnerabilityCount: formattedVulns.length
    });

    /* ================= UPDATE REPO ================= */
    await Repo.findByIdAndUpdate(repoId, {
      scanCount: newVersion,
      riskScore: risk,
      dependencyCount: uniqueDeps.length,
      vulnerabilityCount: formattedVulns.length,
      lastScanned: new Date(),
      status: "scanned"
    });

    console.log("📊 Scan Completed ✅");
    console.log("==================================\n");

    return {
      version: newVersion,
      dependencies: uniqueDeps,
      vulnerabilities: formattedVulns,
      changes: depChanges,
      riskScore: risk,
      aiInsights,
      alerts,
      depEdges
    };

  } catch (err) {
    console.log("❌ Analysis Error:", err.message);
    throw err;
  }
};
