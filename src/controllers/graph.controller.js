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
   🚀 GET GRAPH (TREE FIXED)
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

    const nodes = [];
    const edges = [];

    const nodeSet = new Set();
    const edgeSet = new Set();

    /* =========================
       🟢 REPO NODE
    ========================= */
    nodes.push({
      id: repoIdStr,
      label: repo.name,
      type: "repo",
      size: 30
    });

    nodeSet.add(repoIdStr);

    /* =========================
       🟡 DEPENDENCIES (TREE STRUCTURE)
    ========================= */
    deps.forEach(dep => {
      const depId = dep.name;

      if (!nodeSet.has(depId)) {
        nodes.push({
          id: depId,
          label: `${dep.name}@${dep.version}`,
          type: "dependency",
          size: 14
        });
        nodeSet.add(depId);
      }

      // ROOT DEPENDENCY (repo → dep)
      if (!dep.parent) {
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

      // NESTED DEPENDENCY (dep → child dep)
      if (dep.parent) {
        const edgeKey = `${dep.parent}-${depId}`;
        if (!edgeSet.has(edgeKey)) {
          edges.push({
            from: dep.parent,
            to: depId,
            type: "child"
          });
          edgeSet.add(edgeKey);
        }
      }
    });

    /* =========================
       🔴 VULNERABILITIES (GROUPED UNDER DEP)
    ========================= */
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

      if (!nodeSet.has(vulnId)) {
        nodes.push({
          id: vulnId,
          label: `${v.cve || "No CVE"}`,
          type: "vulnerability",
          severity: v.severity,
          color: getSeverityColor(v.severity),
          size: 18
        });

        nodeSet.add(vulnId);
      }

      // DEPENDENCY → VULNERABILITY (IMPORTANT FIX)
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
