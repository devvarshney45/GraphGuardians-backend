import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Repo from "../models/repo.model.js";

/* =========================
   🎨 SEVERITY COLOR
========================= */
const getSeverityColor = (severity) => {
  switch (severity) {
    case "CRITICAL": return "#ff0000";
    case "HIGH": return "#ff4d4d";
    case "MEDIUM": return "#ffa500";
    case "LOW": return "#ffff00";
    default: return "#999";
  }
};

/* =========================
   🚀 GET GRAPH (FINAL FIXED TREE)
========================= */
export const getGraph = async (req, res) => {
  try {
    const { repoId } = req.params;

    /* =========================
       🔍 Repo Check
    ========================= */
    const repo = await Repo.findById(repoId).lean();
    if (!repo) {
      return res.status(404).json({ msg: "Repo not found" });
    }

    if (repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    const repoIdStr = repo._id.toString();
    const latestVersion = repo.scanCount;

    const [deps, vulns] = await Promise.all([
      Dependency.find({ repoId, versionGroup: latestVersion }).lean(),
      Vulnerability.find({ repoId, versionGroup: latestVersion }).lean()
    ]);

    let nodes = [];
    let edges = [];

    const nodeSet = new Set();
    const edgeSet = new Set();

    /* =========================
       🟢 REPO NODE
    ========================= */
    const repoNode = {
      id: repoIdStr,
      label: repo.name,
      type: "repo",
      size: 30
    };

    nodes.push(repoNode);
    nodeSet.add(repoIdStr);

    /* =========================
       🟡 DEPENDENCY NODES (FIXED 🔥)
    ========================= */
    const dependencyNodes = deps.map(dep => ({
      id: dep.name,
      label: dep.name,
      type: "dependency",
      size: 22
    }));

    dependencyNodes.forEach(dep => {
      if (!nodeSet.has(dep.id)) {
        nodes.push(dep);
        nodeSet.add(dep.id);
      }

      // Repo → Dependency edge
      const edgeKey = `${repoIdStr}-${dep.id}`;
      if (!edgeSet.has(edgeKey)) {
        edges.push({
          from: repoIdStr,
          to: dep.id,
          type: "root"
        });
        edgeSet.add(edgeKey);
      }
    });

    /* =========================
       🔴 VULNERABILITY NODES
    ========================= */
    const vulnerabilityNodes = [];

    const severityCount = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    };

    vulns.forEach(v => {
      const vulnId = `${v.package}_${v.cve || Math.random()}`;

      severityCount[v.severity] =
        (severityCount[v.severity] || 0) + 1;

      const vulnNode = {
        id: vulnId,
        label: v.cve || "No CVE",
        type: "vulnerability",
        severity: v.severity,
        color: getSeverityColor(v.severity),
        size: 18
      };

      if (!nodeSet.has(vulnId)) {
        vulnerabilityNodes.push(vulnNode);
        nodes.push(vulnNode);
        nodeSet.add(vulnId);
      }

      // Dependency → Vulnerability edge (🔥 MAIN FIX)
      const edgeKey = `${v.package}-${vulnId}`;
      if (!edgeSet.has(edgeKey)) {
        edges.push({
          from: v.package,
          to: vulnId,
          type: "vuln"
        });
        edgeSet.add(edgeKey);
      }
    });

    /* =========================
       📊 STATS
    ========================= */
    const stats = {
      version: latestVersion,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      dependencies: dependencyNodes.length,
      vulnerabilities: vulnerabilityNodes.length,
      severity: severityCount
    };

    /* =========================
       🚀 RESPONSE
    ========================= */
    return res.json({
      success: true,
      version: latestVersion,
      nodes,
      edges,
      stats
    });

  } catch (err) {
    console.log("❌ Graph Error:", err.message);

    return res.status(500).json({
      success: false,
      error: "Graph generation failed"
    });
  }
};
