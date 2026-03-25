import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Repo from "../models/repo.model.js";

/* =========================
   💀 FIND VULNERABLE CHAINS (SMART)
========================= */
const findVulnerableChains = (edges, vulns) => {
  const vulnSet = new Set(vulns.map(v => v.package));

  return edges.filter(
    (e) =>
      e.type === "depends_on" &&
      (vulnSet.has(e.from) || vulnSet.has(e.to))
  );
};

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
   🚀 GET GRAPH (ULTRA PRO MAX - FINAL)
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

    /* =========================
       🔥 LATEST VERSION ONLY (IMPORTANT FIX)
    ========================= */
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
       🟡 DEPENDENCIES
    ========================= */
    deps.forEach(dep => {
      const depId = dep.name;

      if (!nodeSet.has(depId)) {
        nodes.push({
          id: depId,
          label: `${dep.name}@${dep.version}`,
          type: "dependency",
          size: 12
        });
        nodeSet.add(depId);
      }

      // repo → dependency
      const edgeKey1 = `${repoIdStr}-${depId}-uses`;
      if (!edgeSet.has(edgeKey1)) {
        edges.push({
          from: repoIdStr,
          to: depId,
          type: "uses"
        });
        edgeSet.add(edgeKey1);
      }

      // dependency chain
      if (dep.parent) {
        const edgeKey2 = `${dep.parent}-${depId}-depends`;
        if (!edgeSet.has(edgeKey2)) {
          edges.push({
            from: dep.parent,
            to: depId,
            type: "depends_on"
          });
          edgeSet.add(edgeKey2);
        }
      }
    });

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
      const vulnId = `${v.package}_${v.cve || "unknown"}`;

      severityCount[v.severity] =
        (severityCount[v.severity] || 0) + 1;

      if (!nodeSet.has(vulnId)) {
        nodes.push({
          id: vulnId,
          label: `${v.package} (${v.severity})`,
          type: "vulnerability",
          severity: v.severity,
          color: getSeverityColor(v.severity),
          size: 18
        });

        nodeSet.add(vulnId);
      }

      const edgeKey3 = `${v.package}-${vulnId}-vuln`;
      if (!edgeSet.has(edgeKey3)) {
        edges.push({
          from: v.package,
          to: vulnId,
          type: "has_vulnerability"
        });
        edgeSet.add(edgeKey3);
      }
    });

    /* =========================
       💀 CHAINS (USP FEATURE)
    ========================= */
    const chains = findVulnerableChains(edges, vulns);

    /* =========================
       📊 STATS
    ========================= */
    const stats = {
      version: latestVersion,
      totalNodes: nodes.length,
      totalEdges: edges.length,
      dependencies: deps.length,
      vulnerabilities: vulns.length,
      severity: severityCount,
      vulnerableChains: chains.length
    };

    /* =========================
       🚀 RESPONSE
    ========================= */
    return res.json({
      success: true,
      version: latestVersion,
      nodes,
      edges,
      chains,
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
