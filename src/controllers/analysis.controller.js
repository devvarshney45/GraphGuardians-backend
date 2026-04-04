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

import { pushToTigerGraph } from "../services/tigergraph.service.js";
import { generateAIInsights } from "../services/ai.service.js";
import { sendNotification } from "../services/firebase.service.js";

import {
findNewVulnerabilities,
findFixedVulnerabilities,
generateAlerts
} from "../utils/diff.util.js";
const normalizeSeverity = (sev) => {
  if (!sev) return "LOW";

  const s = sev.toUpperCase();

  if (s === "MODERATE") return "MEDIUM"; // 🔥 MAIN FIX
  if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(s)) return s;

  return "LOW";
};
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
      if (lockfile?.packages || lockfile?.dependencies) {
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

    console.log("🌳 TREE SIZE:", tree.length);
    console.log("🌳 TREE SAMPLE:", tree.slice(0, 5));

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
        parent: d.parent ? d.parent.toLowerCase() : null,
        type: "prod"
      }));

    console.log(`📦 Dependencies Saved: ${uniqueDeps.length}`);
    console.log("📦 SAMPLE DEP:", uniqueDeps[0]);

    await Dependency.insertMany(uniqueDeps, { ordered: false }).catch(() => {});

    /* ========================= VULNERABILITIES ========================= */
    let formattedVulns = [];

    try {
      const vulns = await checkVulnerabilities(uniqueDeps);

      formattedVulns = vulns.map(v => ({
  repoId: repoIdStr,
  versionGroup: newVersion,
  package: v.package?.toLowerCase(),
  version: String(v.version || ""),

  // 🔥 FIXED LINE
  severity: normalizeSeverity(v.severity),

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
    /* ========================= ALERTS ========================= */
/* ========================= ALERTS (FIXED 🔥) ========================= */
/* ========================= ALERTS ========================= */
/* ========================= ALERTS (FINAL FIXED 🔥) ========================= */
let alerts = [];

try {
  const repoObjectId = repo._id;

  // 🔥 CLEAN VALID VULNS
  const safeVulns = formattedVulns.filter(
    v => v.package && v.severity
  );

  console.log("🧹 CLEAN VULNS:", safeVulns.length);

  let newVulns = [];
  let fixedVulns = [];

  if (newVersion === 1) {
    // 🟢 FIRST SCAN → ALL ALERTS
    console.log("🟢 FIRST SCAN → ALL ALERTS");

    newVulns = safeVulns;

  } else {
    // 🔵 DIFF BASED ALERTS
    const previousVulns = await Vulnerability.find({
      repoId: repoIdStr,
      versionGroup: newVersion - 1
    }).lean();

    newVulns = findNewVulnerabilities(previousVulns, safeVulns);
    fixedVulns = findFixedVulnerabilities(previousVulns, safeVulns);

    console.log("🆕 NEW:", newVulns.length);
    console.log("✅ FIXED:", fixedVulns.length);
  }

  // 🔥 GENERATE ALERTS
  alerts = generateAlerts(repoObjectId, newVulns, fixedVulns);

  // 🔥 FINAL SAFETY FILTER (IMPORTANT)
  alerts = alerts.filter(a =>
    a.package &&
    ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(a.severity)
  );

  console.log("📢 FINAL ALERTS:", alerts.length);

  // 🔥 SAVE
  if (alerts.length > 0) {
    const result = await Alert.insertMany(alerts);

    console.log("✅ ALERTS SAVED:", result.length);
  } else {
    console.log("⚠️ NO ALERTS TO SAVE");
  }

} catch (err) {
  console.log("❌ ALERT ERROR:", err.message);
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

    /* ========================= TIGERGRAPH ========================= */

    const depEdges = tree
      .filter(d => d.parent)
      .map(d => ({
        from: d.parent.toLowerCase(),
        to: d.name.toLowerCase()
      }));

    console.log("🔗 DEP EDGES COUNT:", depEdges.length);
    console.log("🔗 DEP EDGES SAMPLE:", depEdges.slice(0, 5));

    if (depEdges.length === 0) {
      console.log("❌ NO DEPENDENCY CHAIN FOUND → TigerGraph will be EMPTY");
    }

    console.log("🚀 PUSHING TO TIGERGRAPH...");

    await pushToTigerGraph(
      repoIdStr,
      uniqueDeps.map(d => ({
        name: d.name,
        version: d.version
      })),
      formattedVulns.map(v => ({
        package: v.package,
        cve: v.cve,
        severity: v.severity,
        description: v.description
      })),
      depEdges
    ).catch((err) => {
      console.log("❌ TigerGraph push failed:", err.message);
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

/* ========================= SOCKET EMIT ========================= */
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
