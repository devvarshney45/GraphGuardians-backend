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
   🚀 ANALYZE REPO (FINAL)
========================= */
export const analyzeRepo = async (req, res) => {
  try {
    const safeRes = {
      status: () => safeRes,
      json: () => {}
    };

    const response = res?.status ? res : safeRes;

    const { url, repoId, token } = req.body;

    /* ========================= VALIDATION ========================= */
    const repo = await Repo.findById(repoId);
    if (!repo) return response.status(404).json({ msg: "Repo not found" });

    if (repo.userId.toString() !== req.user.id) {
      return response.status(403).json({ msg: "Unauthorized" });
    }

    const repoIdStr = String(repoId);

    /* ========================= 🔥 SET STATUS ========================= */
    await Repo.findByIdAndUpdate(repoId, {
      status: "scanning"
    });

    /* ========================= VERSION ========================= */
    const currentVersion = repo.scanCount || 0;
    const newVersion = currentVersion + 1;

    console.log(`🚀 FAST SCAN START: ${repo.name}`);

    /* ========================= 📥 FETCH FILES ========================= */
    const [lockfile, pkg] = await Promise.all([
      fetchFileFromGitHub(url, "package-lock.json", token),
      fetchFileFromGitHub(url, "package.json", token)
    ]);

    if (!pkg) {
      return response.status(400).json({
        msg: "package.json not found"
      });
    }

    /* ========================= 🌳 BUILD TREE ========================= */
    let tree = [];

    if (lockfile && lockfile.dependencies) {
      console.log("✅ Using LOCKFILE (accurate)");
      tree = buildTreeFromLockfile(lockfile);
    } else {
      console.log("⚠️ No lockfile → fallback");
      const deps = pkg.dependencies || {};

      tree = Object.entries(deps).map(([name, version]) => ({
        name,
        version: version || "latest",
        parent: null
      }));
    }

    console.log(`🌳 Tree size: ${tree.length}`);

    /* ========================= 📦 SAVE DEPENDENCIES ========================= */
    const uniqueDeps = tree.map(d => ({
      repoId: repoIdStr,
      versionGroup: newVersion,
      name: d.name.toLowerCase(),
      version: String(d.version || "unknown"),
      type: "prod"
    }));

    if (uniqueDeps.length) {
      await Dependency.insertMany(uniqueDeps, { ordered: false });
    }

    /* ========================= 🚨 VULNERABILITIES (PARALLEL) ========================= */
    const vulns = await checkVulnerabilities(uniqueDeps);

    const formattedVulns = vulns.map(v => ({
      repoId: repoIdStr,
      versionGroup: newVersion,
      package: v.package.toLowerCase(),
      version: String(v.version || ""),
      severity: v.severity,
      cve: v.cve,
      fix: v.fix
    }));

    if (formattedVulns.length) {
      await Vulnerability.insertMany(formattedVulns, { ordered: false });
    }

    console.log(`🚨 Vulnerabilities: ${formattedVulns.length}`);

    /* ========================= 🔔 ALERTS ========================= */
    const alerts = generateAlerts(
      repoIdStr,
      findNewVulnerabilities([], formattedVulns),
      findFixedVulnerabilities([], formattedVulns)
    );

    if (alerts.length) {
      await Alert.insertMany(alerts);
    }

    /* ========================= 🔗 EDGES ========================= */
    const cleanEdges = tree
      .filter(d => d.parent)
      .map(d => ({
        from: d.parent,
        to: d.name
      }));

    /* ========================= 🔥 NEO4J ========================= */
    await pushToNeo4j(
      repoIdStr,
      uniqueDeps,
      formattedVulns,
      cleanEdges
    );

    /* ========================= 📊 RISK ========================= */
    const risk = calculateRisk(formattedVulns);

    await ScanHistory.create({
      repoId: repoIdStr,
      version: newVersion,
      riskScore: risk,
      dependencyCount: uniqueDeps.length,
      vulnerabilityCount: formattedVulns.length
    });

    /* ========================= UPDATE REPO ========================= */
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

    console.log("✅ FAST SCAN COMPLETE");

    /* ========================= 🔥 SOCKET EMIT ========================= */
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

    /* ========================= RESPONSE ========================= */
    return response.json({
      success: true,
      repo: updatedRepo
    });

  } catch (err) {
    console.log("❌ Analyze Error:", err.message);

    if (res?.status) {
      return res.status(500).json({ error: err.message });
    }
  }
};
