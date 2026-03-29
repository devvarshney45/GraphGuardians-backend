import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";
import ScanHistory from "../models/scanHistory.model.js";
import User from "../models/user.model.js";

import { fetchFileFromGitHub } from "../services/githubContent.service.js";
import { buildTreeFromLockfile } from "../services/dependencyTree.service.js";

import { checkVulnerabilities } from "../services/vulnerability.service.js";
import { calculateRisk } from "../utils/risk.util.js";

// ❌ REMOVED Neo4j
// import { pushToNeo4j } from "../services/neo4j.service.js";

// ✅ TigerGraph only
import { pushToTigerGraph } from "../services/tigergraph.service.js";

import { generateAIInsights } from "../services/ai.service.js";
import { sendNotification } from "../services/firebase.service.js";

import {
  findNewVulnerabilities,
  findFixedVulnerabilities,
  generateAlerts
} from "../utils/diff.util.js";

export const analyzeRepo = async (req, res) => {
  const TIMEOUT = 25000;

  const safeRes = {
    status: () => safeRes,
    json: () => {}
  };

  const response = res?.status ? res : safeRes;

  const main = async () => {
    const { url, repoId, token } = req.body;

    const repo = await Repo.findById(repoId);
    if (!repo) return response.status(404).json({ msg: "Repo not found" });

    if (repo.userId.toString() !== req.user.id) {
      return response.status(403).json({ msg: "Unauthorized" });
    }

    const repoIdStr = String(repoId);

    await Repo.findByIdAndUpdate(repoId, { status: "scanning" });

    const newVersion = (repo.scanCount || 0) + 1;

    console.log(`🚀 SCAN START: ${repo.name}`);

    /* ========================= FETCH FILES ========================= */
    let lockfile = null;
    let pkg = null;

    try {
      [lockfile, pkg] = await Promise.all([
        fetchFileFromGitHub(url, "package-lock.json", token),
        fetchFileFromGitHub(url, "package.json", token)
      ]);
    } catch {
      console.log("⚠️ GitHub fetch failed");
    }

    /* ========================= NO PACKAGE ========================= */
    if (!pkg) {
      const updatedRepo = await Repo.findByIdAndUpdate(
        repoId,
        {
          scanCount: newVersion,
          riskScore: 0,
          dependencyCount: 0,
          vulnerabilityCount: 0,
          lastScanned: new Date(),
          status: "scanned"
        },
        { new: true }
      ).lean();

      emitResult(req, repoIdStr, updatedRepo, 0, 0, 0, []);

      return response.json({
        success: true,
        repo: updatedRepo
      });
    }

    /* ========================= TREE ========================= */
    let tree = [];

    try {
      if (lockfile?.dependencies) {
        console.log("✅ LOCKFILE MODE");
        tree = buildTreeFromLockfile(lockfile);
      } else {
        console.log("⚠️ FALLBACK MODE");
        const deps = pkg.dependencies || {};

        tree = Object.entries(deps).map(([name, version]) => ({
          name,
          version: version || "latest",
          parent: null
        }));
      }
    } catch {
      console.log("⚠️ Tree build failed");
    }

    /* ========================= UNIQUE DEPS ========================= */
    const seen = new Set();

    const uniqueDeps = tree
      .filter(d => {
        const key = `${d.name}@${d.version}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(d => ({
        repoId: repoIdStr,
        versionGroup: newVersion,
        name: d.name.toLowerCase(),
        version: String(d.version || "unknown"),
        type: "prod"
      }));

    console.log(`📦 Dependencies: ${uniqueDeps.length}`);

    await Dependency.insertMany(uniqueDeps, { ordered: false }).catch(() => {});

    /* ========================= VULNERABILITIES ========================= */
    let formattedVulns = [];

    try {
      const vulns = await checkVulnerabilities(uniqueDeps);

      formattedVulns = vulns.map(v => ({
        repoId: repoIdStr,
        versionGroup: newVersion,
        package: v.package.toLowerCase(),
        version: String(v.version || ""),
        severity: v.severity,
        cve: v.cve,
        fix: v.fix,
        description: v.description || ""
      }));

      await Vulnerability.insertMany(formattedVulns, { ordered: false }).catch(() => {});
    } catch {
      console.log("⚠️ Vulnerability check failed");
    }

    console.log(`🚨 Vulnerabilities: ${formattedVulns.length}`);

    /* ========================= ALERTS ========================= */
    let alerts = [];

    try {
      alerts = generateAlerts(
        repoIdStr,
        findNewVulnerabilities([], formattedVulns),
        findFixedVulnerabilities([], formattedVulns)
      );

      await Alert.insertMany(alerts).catch(() => {});
    } catch {}

    /* ========================= AI ========================= */
  /* ========================= AI ========================= */
let aiInsights = {};

try {
  console.log("🧠 Generating AI insights...");

  // 🔥 1. SAFE LIMIT (avoid overload)
  const limitedVulns = formattedVulns.slice(0, 50); // max 50 (enough context)

  // 🔥 2. GROUP DATA (IMPORTANT)
  const summaryText = limitedVulns.map(v => 
    `${v.package} - ${v.description} (${v.severity})`
  ).join("\n");

  // 🔥 3. BUILD SMART PAYLOAD
  const aiPayload = {
    totalDependencies: uniqueDeps.length,
    totalVulnerabilities: formattedVulns.length,
    severity: {
      critical: formattedVulns.filter(v => v.severity === "CRITICAL").length,
      high: formattedVulns.filter(v => v.severity === "HIGH").length,
      medium: formattedVulns.filter(v => v.severity === "MEDIUM").length,
      low: formattedVulns.filter(v => v.severity === "LOW").length
    },
    data: summaryText
  };

  // 🔥 4. SINGLE AI CALL (MAIN FIX 💯)
  aiInsights = await generateAIInsights(aiPayload);

  console.log("✅ AI insights generated");

} catch (err) {
  console.log("⚠️ AI failed:", err.message);

  // 🔥 5. FALLBACK (NEVER BREAK UI)
  aiInsights = {
    summary: "AI insights not available",
    risks: [],
    fixes: []
  };
}
    /* ========================= PUSH NOTIFICATION ========================= */
    try {
      const user = await User.findById(repo.userId);

      if (user?.fcmToken && alerts.length > 0) {
        await sendNotification(
          user.fcmToken,
          "🚨 Security Alert",
          `${alerts.length} new vulnerabilities detected`
        );
      }
    } catch (err) {
      console.log("❌ Push failed:", err.message);
    }

    /* ========================= GRAPH ========================= */
// 🔥 IMPORTANT CHANGE: tree bhi pass karna hai TigerGraph ko

/* ========================= GRAPH ========================= */

// 🔥 BUILD DEP-DEP CHAINS
const depEdges = tree
  .filter(d => d.parent)
  .map(d => ({
    from: d.parent.toLowerCase(),
    to: d.name.toLowerCase()
  }));

// 🔥 ONLY TigerGraph (CHAIN ENABLED)
await pushToTigerGraph(
  repoIdStr,

  // 📦 dependencies
  uniqueDeps.map(d => ({
    name: d.name,
    version: d.version
  })),

  // 🚨 vulnerabilities
  formattedVulns.map(v => ({
    package: v.package,
    cve: v.cve,
    severity: v.severity,
    description: v.description
  })),

  // 🔥 NEW: dependency chain edges
  depEdges
).catch(() => {
  console.log("⚠️ TigerGraph failed");
});
    

    /* ========================= RISK ========================= */
    const risk = calculateRisk(formattedVulns);

    await ScanHistory.create({
      repoId: repoIdStr,
      version: newVersion,
      riskScore: risk,
      dependencyCount: uniqueDeps.length,
      vulnerabilityCount: formattedVulns.length
    }).catch(() => {});

    /* ========================= UPDATE ========================= */
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

    console.log("✅ SCAN COMPLETE");

    emitResult(
      req,
      repoIdStr,
      updatedRepo,
      risk,
      uniqueDeps.length,
      formattedVulns.length,
      aiInsights
    );

    return response.json({
      success: true,
      repo: updatedRepo,
      aiInsights
    });
  };

  try {
    await Promise.race([
      main(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Scan timeout")), TIMEOUT)
      )
    ]);
  } catch (err) {
    console.log("❌ TIMEOUT:", err.message);

    const { repoId } = req.body;

    await Repo.findByIdAndUpdate(repoId, {
      status: "scanned",
      riskScore: 0
    });

    emitResult(req, repoId, { name: "Timeout Repo" }, 0, 0, 0, []);
  }
};

const emitResult = (req, repoIdStr, repo, risk, deps, vulns, aiInsights = []) => {
  const io = req.app.get("io");

  if (io) {
    io.to(repoIdStr).emit(`scan-${repoIdStr}`, {
      repo,
      stats: {
        riskScore: risk,
        dependencies: deps,
        vulnerabilities: vulns
      },
      aiInsights
    });
  }
};
