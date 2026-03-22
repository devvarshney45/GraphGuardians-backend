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

    /* ========================= VALIDATION ========================= */
    const repo = await Repo.findById(repoId);
    if (!repo) return response.status(404).json({ msg: "Repo not found" });

    if (repo.userId.toString() !== req.user.id) {
      return response.status(403).json({ msg: "Unauthorized" });
    }

    const repoIdStr = String(repoId);

    /* ========================= 🔥 SET STATUS (START) ========================= */
    await Repo.findByIdAndUpdate(repoId, {
      status: "scanning"
    });

    /* ========================= VERSION ========================= */
    const currentVersion = repo.scanCount || 0;
    const newVersion = currentVersion + 1;

    console.log(`🚀 Scanning repo: ${repo.name}`);

    /* ========================= FETCH PACKAGE ========================= */
    const pkg = await fetchPackageJson(url, token);
    if (!pkg) {
      return response.status(400).json({
        msg: "package.json not accessible"
      });
    }

    /* ========================= DEPENDENCIES ========================= */
    const rawDeps = extractDependencies(pkg);

    const uniqueDeps = rawDeps.map(d => ({
      repoId: repoIdStr,
      versionGroup: newVersion,
      name: d.name.toLowerCase().trim(),
      version: String(d.version || "unknown"),
      type: d.type || "prod"
    }));

    await Dependency.insertMany(uniqueDeps, { ordered: false });

    /* ========================= VULNERABILITIES ========================= */
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

    /* ========================= ALERTS ========================= */
    const alerts = generateAlerts(
      repoIdStr,
      [],
      []
    );

    if (alerts.length) {
      await Alert.insertMany(alerts);
    }

    /* ========================= TREE ========================= */
    let cleanEdges = [];

    try {
      const tree = await getDependencyTree(url, token);

      if (tree) {
        cleanEdges = extractDependencyEdges(tree);
      }
    } catch {}

    /* ========================= NEO4J ========================= */
    await pushToNeo4j(
      repoIdStr,
      uniqueDeps,
      formattedVulns,
      cleanEdges
    );

    /* ========================= RISK ========================= */
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

    console.log("✅ Scan complete");

    /* ========================= 🔥 SOCKET EMIT (FINAL FIX) ========================= */
    const io = req.app.get("io");

    if (io) {
      io.to(repoIdStr).emit("scanComplete", {
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
