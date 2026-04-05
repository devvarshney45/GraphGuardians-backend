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
import { sendNotification, writeToFirestore } from "./firebase.service.js";

import {
  compareDependencies,
  findNewVulnerabilities,
  findFixedVulnerabilities,
  generateAlerts
} from "../utils/diff.util.js";

export const runAnalysis = async (url, repoId, token) => {
  try {
    console.log("\n🚀 ===============================");

    /* =========================
       🔐 VALIDATE TOKEN (🔥 FIX)
    ========================= */
    if (!token) {
      console.log("❌ Missing GitHub token");
      return;
    }

    console.log("🔑 Token present:", !!token);
    console.log("🌐 Repo URL:", url);

    /* =========================
       🔐 GET REPO
    ========================= */
    const repo = await Repo.findById(repoId);
    if (!repo) throw new Error("Repo not found");

    const currentVersion = repo.scanCount || 0;
    const newVersion = currentVersion + 1;

    console.log(`📦 Repo: ${repo.name}`);
    console.log(`🔢 Version: ${currentVersion} → ${newVersion}`);

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
       📥 FETCH package.json (🔥 FIX SAFE)
    ========================= */
    let pkg;

    try {
      pkg = await fetchPackageJson(url, token);
      console.log("📥 package.json fetched");
    } catch (err) {
      console.log("❌ package.json fetch failed:", err.message);

      await Repo.findByIdAndUpdate(repoId, {
        status: "scanned",
        riskScore: 0
      });

      return;
    }

    /* =========================
       📦 EXTRACT DEPENDENCIES
    ========================= */
    const rawDeps = extractDependencies(pkg) || [];

    const seen = new Set();
    const uniqueDeps = [];

    for (const d of rawDeps) {
      if (!d?.name) continue;

      const name = d.name.toLowerCase().trim();
      const key = `${name}_${newVersion}`;

      if (!seen.has(key)) {
        seen.add(key);

        uniqueDeps.push({
          repoId,
          versionGroup: newVersion,
          name,
          version: d.version || "unknown",
          cleanVersion: d.cleanVersion || "",
          type: d.type || "prod"
        });
      }
    }

    console.log(`📦 Dependencies: ${uniqueDeps.length}`);

    /* =========================
       🔄 COMPARE DEPENDENCIES
    ========================= */
    const depChanges = compareDependencies(oldDeps, uniqueDeps);

    console.log(`➕ Added: ${depChanges.added.length}`);
    console.log(`❌ Removed: ${depChanges.removed.length}`);
    console.log(`♻️ Updated: ${depChanges.updated.length}`);

    /* =========================
       💾 SAVE DEPENDENCIES
    ========================= */
    if (uniqueDeps.length > 0) {
      await Dependency.insertMany(uniqueDeps, { ordered: false }).catch(() => {});
    }

    /* =========================
       🚨 VULNERABILITIES (🔥 SAFE)
    ========================= */
    let vulns = [];

    try {
      vulns = await checkVulnerabilities(uniqueDeps);
    } catch (err) {
      console.log("❌ Vulnerability check failed:", err.message);
    }

    const formattedVulns = (vulns || []).map(v => ({
      repoId,
      versionGroup: newVersion,
      package: v.package?.toLowerCase()?.trim(),
      version: v.version,
      severity: v.severity || "LOW",
      description: v.description,
      cve: v.cve,
      fix: v.fix
    }));

    if (formattedVulns.length > 0) {
      await Vulnerability.insertMany(formattedVulns, { ordered: false }).catch(() => {});
    }

    console.log(`🚨 Vulnerabilities: ${formattedVulns.length}`);

    /* =========================
       🔔 ALERTS
    ========================= */
    const newVulns = findNewVulnerabilities(oldVulns, formattedVulns);
    const fixedVulns = findFixedVulnerabilities(oldVulns, formattedVulns);

    const alerts = generateAlerts(repoId, newVulns, fixedVulns);

    if (alerts.length > 0) {
      await Alert.insertMany(alerts).catch(() => {});
      console.log(`🔔 Alerts generated: ${alerts.length}`);
    } else {
      console.log("✅ No new alerts");
    }

    /* =========================
       ⚠️ RISK SCORE
    ========================= */
    const risk = calculateRisk(formattedVulns);
    console.log(`⚠️ Risk Score: ${risk}`);

    /* =========================
       🤖 AI INSIGHTS
    ========================= */
    let aiInsights = [];
    try {
      aiInsights = await generateAIInsights(formattedVulns.slice(0, 5));
    } catch (err) {
      console.log("⚠️ AI failed:", err.message);
    }

    /* =========================
       🌳 DEPENDENCY TREE (🔥 SAFE)
    ========================= */
    let depEdges = [];

    try {
      console.log("🌳 Generating dependency tree...");

      const tree = await getDependencyTree(url, token);

      if (tree) {
        depEdges = extractDependencyEdges(tree) || [];
      }

    } catch (err) {
      console.log("⚠️ Tree error:", err.message);
    }

    console.log(`🔗 Dependency edges: ${depEdges.length}`);

    /* =========================
       🧠 TIGERGRAPH
    ========================= */
    try {
      await pushToTigerGraph(
        repoId,
        uniqueDeps.map(d => ({ name: d.name, version: d.version })),
        formattedVulns,
        depEdges
      );
      console.log("🧠 TigerGraph Sync Done ✅");
    } catch (err) {
      console.log("⚠️ TigerGraph error:", err.message);
    }

    /* =========================
       🔔 PUSH NOTIFICATION
    ========================= */
    try {
      const user = await User.findById(repo.userId);

      if (user?.fcmToken && alerts.length > 0) {
        await sendNotification(
          user.fcmToken,
          "🚨 Security Alert",
          `${alerts.length} new vulnerabilities detected`,
          { repoId: String(repoId) }
        );

        console.log("📲 Notifications sent");
      }
    } catch (err) {
      console.log("❌ Notification error:", err.message);
    }

    /* =========================
       🔥 FIRESTORE
    ========================= */
    try {
      await writeToFirestore({
        repoId: String(repoId),
        alerts,
        vulnerabilities: formattedVulns,
        riskScore: risk,
        version: newVersion
      });

      console.log("🔥 Firestore updated");
    } catch (err) {
      console.log("❌ Firestore error:", err.message);
    }

    /* =========================
       📊 SCAN HISTORY
    ========================= */
    await ScanHistory.create({
      repoId,
      version: newVersion,
      riskScore: risk,
      dependencyCount: uniqueDeps.length,
      vulnerabilityCount: formattedVulns.length
    }).catch(() => {});

    /* =========================
       🔄 UPDATE REPO
    ========================= */
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
