import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";
import ScanHistory from "../models/scanHistory.model.js";
import User from "../models/user.model.js";

import { fetchFileFromGitHub } from "../services/githubContent.service.js";
import { buildTreeFromLockfile } from "../services/tree.service.js";

import { checkVulnerabilities } from "../services/vulnerability.service.js";
import { calculateRisk } from "../utils/risk.util.js";
import { pushToNeo4j } from "../services/neo4j.service.js";
import { sendNotification } from "../services/firebase.service.js";

import {
  findNewVulnerabilities,
  findFixedVulnerabilities,
  generateAlerts
} from "../utils/diff.util.js";

/* =========================
   🚀 ANALYZE REPO (ULTIMATE)
========================= */
export const analyzeRepo = async (req, res) => {
  const TIMEOUT = 25000; // 🔥 25 sec max

  const safeRes = {
    status: () => safeRes,
    json: () => {}
  };

  const response = res?.status ? res : safeRes;

  const main = async () => {
    const { url, repoId, token } = req.body;

    /* ========================= VALIDATION ========================= */
    const repo = await Repo.findById(repoId);
    if (!repo) return response.status(404).json({ msg: "Repo not found" });

    if (repo.userId.toString() !== req.user.id) {
      return response.status(403).json({ msg: "Unauthorized" });
    }

    const repoIdStr = String(repoId);

    /* ========================= STATUS ========================= */
    await Repo.findByIdAndUpdate(repoId, { status: "scanning" });

    const currentVersion = repo.scanCount || 0;
    const newVersion = currentVersion + 1;

    console.log(`🚀 FAST SCAN START: ${repo.name}`);

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

    if (!pkg) {
      await Repo.findByIdAndUpdate(repoId, { status: "error" });
      return response.status(400).json({ msg: "package.json not found" });
    }

    /* ========================= TREE ========================= */
    let tree = [];

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

    /* ========================= REMOVE DUPLICATES ========================= */
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

    if (uniqueDeps.length) {
      await Dependency.insertMany(uniqueDeps, { ordered: false }).catch(() => {});
    }

    /* ========================= VULNS ========================= */
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
        fix: v.fix
      }));

      if (formattedVulns.length) {
        await Vulnerability.insertMany(formattedVulns, { ordered: false }).catch(() => {});
      }

    } catch {
      console.log("⚠️ Vulnerability check failed");
    }

    console.log(`🚨 Vulnerabilities: ${formattedVulns.length}`);

    /* ========================= ALERTS ========================= */
    try {
      const alerts = generateAlerts(
        repoIdStr,
        findNewVulnerabilities([], formattedVulns),
        findFixedVulnerabilities([], formattedVulns)
      );

      if (alerts.length) {
        await Alert.insertMany(alerts);
      }
    } catch {}

    /* ========================= GRAPH ========================= */
    const cleanEdges = tree
      .filter(d => d.parent)
      .map(d => ({
        from: d.parent,
        to: d.name
      }));

    try {
      await pushToNeo4j(repoIdStr, uniqueDeps, formattedVulns, cleanEdges);
    } catch {
      console.log("⚠️ Neo4j failed");
    }

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

    /* ========================= SOCKET ========================= */
    const io = req.app.get("io");

    if (io) {
      io.to(repoIdStr).emit(`scan-${repoIdStr}`, {
        repo: updatedRepo,
        stats: {
          riskScore: risk,
          dependencies: uniqueDeps.length,
          vulnerabilities: formattedVulns.length
        }
      });
    }

    return response.json({
      success: true,
      repo: updatedRepo
    });
  };

  /* ========================= TIMEOUT WRAPPER ========================= */
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
      status: "error"
    });

    const io = req.app.get("io");

    if (io) {
      io.to(repoId).emit(`scan-${repoId}`, {
        error: true
      });
    }
  }
};
