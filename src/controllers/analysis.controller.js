import Repo from "../models/repo.model.js";
import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Alert from "../models/alert.model.js";
import ScanHistory from "../models/scanHistory.model.js";
import User from "../models/user.model.js";

import { getDependencyTree } from "../services/dependencyTree.service.js";
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

    const repoIdStr = repoId.toString();
    const newVersion = Number(repo.scanCount || 0) + 1;

    await Repo.findByIdAndUpdate(repoId, { status: "scanning" });

    console.log(`🚀 SCAN START: ${repo.name}`);

    /* ========================= TREE ========================= */
    let tree = [];

    try {
      tree = await getDependencyTree(url, token);
    } catch (err) {
      console.log("❌ Tree error:", err.message);
    }

    console.log("🌳 TREE SIZE:", tree.length);

    if (!tree.length) {
      console.log("⚠️ Empty tree fallback");

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
      return response.json({ success: true, repo: updatedRepo });
    }

    /* ========================= UNIQUE DEPS (FIXED 🔥) ========================= */
    const seen = new Set();

    const uniqueDeps = tree
      .filter(d => {
        const key = `${d.name.toLowerCase()}@${d.version}_${d.parent || "root"}`;
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
        type: d.parent ? "TRANSITIVE" : "DIRECT"
      }));

    console.log("📦 Dependencies:", uniqueDeps.length);

    try {
      await Dependency.insertMany(uniqueDeps, { ordered: false });
    } catch (err) {
      console.log("⚠️ Dependency insert issue:", err.message);
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
        fix: v.fix,
        description: v.description || ""
      }));

      await Vulnerability.insertMany(formattedVulns, { ordered: false });
    } catch (err) {
      console.log("⚠️ Vuln error:", err.message);
    }

    console.log("🚨 Vulns:", formattedVulns.length);

    /* ========================= ALERTS ========================= */
    let alerts = [];

    try {
      alerts = generateAlerts(
        repoIdStr,
        findNewVulnerabilities([], formattedVulns),
        findFixedVulnerabilities([], formattedVulns)
      );

      await Alert.insertMany(alerts);
    } catch {}

    /* ========================= AI ========================= */
    let aiInsights = [];

    try {
      aiInsights = await generateAIInsights(formattedVulns.slice(0, 20));
    } catch {}

    /* ========================= PUSH ========================= */
    try {
      const user = await User.findById(repo.userId);

      if (user?.fcmToken && alerts.length > 0) {
        await sendNotification(
          user.fcmToken,
          "🚨 Security Alert",
          `${alerts.length} new vulnerabilities detected`
        );
      }
    } catch {}

    /* ========================= TIGERGRAPH ========================= */
    const depEdges = tree
      .filter(d => d.parent)
      .map(d => ({
        from: d.parent.toLowerCase(),
        to: d.name.toLowerCase()
      }));

    await pushToTigerGraph(
      repoIdStr,
      uniqueDeps.map(d => ({ name: d.name, version: d.version })),
      formattedVulns,
      depEdges
    ).catch(() => console.log("⚠️ TigerGraph failed"));

    /* ========================= RISK ========================= */
    const risk = calculateRisk(formattedVulns);

    await ScanHistory.create({
      repoId: repoIdStr,
      version: newVersion,
      riskScore: risk,
      dependencyCount: uniqueDeps.length,
      vulnerabilityCount: formattedVulns.length
    });

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

/* ========================= SOCKET ========================= */
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
