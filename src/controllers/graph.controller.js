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
   🚀 GET GRAPH
========================= */
export const getGraph = async (req, res) => {
  try {
    const { repoId } = req.params;
    const { type } = req.query;

    const repo = await Repo.findById(repoId).lean();
    if (!repo) return res.status(404).json({ msg: "Repo not found" });

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
    if (type !== "chain") {
      nodes.push({
        id: repoIdStr,
        label: repo.name,
        type: "repo",
        size: 32,
        color: "#00e5ff"
      });
      nodeSet.add(repoIdStr);
    }

    /* =========================
       🟡 DEPENDENCIES
    ========================= */
    deps.forEach(dep => {
      const depId = dep.name.toLowerCase();

      const isVuln = vulns.some(v => v.package.toLowerCase() === depId);

      if (!nodeSet.has(depId)) {
        nodes.push({
          id: depId,
          label: `${dep.name}@${dep.version}`,
          type: "dependency",
          size: isVuln ? 26 : 22, // 🔥 highlight vulnerable deps
          color: isVuln ? "#ff4d4d" : "#4da6ff",
          isVulnerable: isVuln
        });
        nodeSet.add(depId);
      }

      if (type !== "chain") {
        const edgeKey = `${repoIdStr}-${depId}`;

        if (!edgeSet.has(edgeKey)) {
          edges.push({
            from: repoIdStr,
            to: depId,
            type: "root",
            label: "depends_on"
          });
          edgeSet.add(edgeKey);
        }
      }
    });

    /* =========================
       🔥 CHAIN EDGES
    ========================= */
    if (type === "chain") {
      deps.forEach(dep => {
        if (!dep.parent) return;

        const from = dep.parent.toLowerCase();
        const to = dep.name.toLowerCase();

        // ensure parent exists
        if (!nodeSet.has(from)) {
          nodes.push({
            id: from,
            label: from,
            type: "dependency",
            size: 22,
            color: "#4da6ff"
          });
          nodeSet.add(from);
        }

        const edgeKey = `${from}-${to}`;

        if (!edgeSet.has(edgeKey)) {
          edges.push({
            from,
            to,
            type: "chain",
            label: "depends_on"
          });
          edgeSet.add(edgeKey);
        }
      });
    }

    /* =========================
       🔴 VULNERABILITIES
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

      // ensure dependency exists
      if (!nodeSet.has(depName)) {
        nodes.push({
          id: depName,
          label: depName,
          type: "dependency",
          size: 24,
          color: "#ff4d4d"
        });
        nodeSet.add(depName);
      }

      // vuln node
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
          type: "vuln",
          label: "has_vulnerability"
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
      dependencies: nodes.filter(n => n.type === "dependency").length,
      vulnerabilities: nodes.filter(n => n.type === "vulnerability").length,
      severity: severityCount
    };

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
