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
    case "LOW": return "#22c55e";
    default: return "#999";
  }
};

/* =========================
   🚀 GET GRAPH (NORMAL + CHAIN)
========================= */
export const getGraph = async (req, res) => {
  try {
    const { repoId } = req.params;
    const { type } = req.query; // 🔥 IMPORTANT

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
       🟢 REPO NODE (ONLY NORMAL)
    ========================= */
    if (type !== "chain") {
      const repoNode = {
        id: repoIdStr,
        label: repo.name,
        type: "repo",
        size: 30
      };

      nodes.push(repoNode);
      nodeSet.add(repoIdStr);
    }

    /* =========================
       🟡 DEPENDENCY NODES
    ========================= */
    deps.forEach(dep => {
      const depId = dep.name.toLowerCase();

      if (!nodeSet.has(depId)) {
        nodes.push({
          id: depId,
          label: dep.name,
          type: "dependency",
          size: 22
        });
        nodeSet.add(depId);
      }

      /* =========================
         🟢 NORMAL GRAPH
      ========================= */
      if (type !== "chain") {
        const edgeKey = `${repoIdStr}-${depId}`;

        if (!edgeSet.has(edgeKey)) {
          edges.push({
            from: repoIdStr,
            to: depId,
            type: "root"
          });
          edgeSet.add(edgeKey);
        }
      }
    });

    /* =========================
       🔥 CHAIN GRAPH (DEP → DEP)
    ========================= */
    if (type === "chain") {
      deps.forEach(dep => {
        if (!dep.parent) return;

        const from = dep.parent.toLowerCase();
        const to = dep.name.toLowerCase();

        const edgeKey = `${from}-${to}`;

        if (!edgeSet.has(edgeKey)) {
          edges.push({
            from,
            to,
            type: "chain"
          });
          edgeSet.add(edgeKey);
        }
      });
    }

    /* =========================
       🔴 VULNERABILITY NODES
    ========================= */
    const severityCount = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    };

    vulns.forEach(v => {
      const depName = v.package.toLowerCase();
      const vulnId = `${depName}_${v.cve || Math.random()}`;

      severityCount[v.severity] =
        (severityCount[v.severity] || 0) + 1;

      if (!nodeSet.has(vulnId)) {
        nodes.push({
          id: vulnId,
          label: v.cve || "No CVE",
          type: "vulnerability",
          severity: v.severity,
          color: getSeverityColor(v.severity),
          size: 18
        });
        nodeSet.add(vulnId);
      }

      const edgeKey = `${depName}-${vulnId}`;

      if (!edgeSet.has(edgeKey)) {
        edges.push({
          from: depName,
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
      dependencies: deps.length,
      vulnerabilities: vulns.length,
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
