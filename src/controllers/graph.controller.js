import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Repo from "../models/repo.model.js";

/* =========================
   💀 FIND VULNERABLE CHAINS
========================= */
const findVulnerableChains = (edges, vulns) => {
  const vulnSet = new Set(vulns.map(v => v.package));

  return edges.filter(e =>
    vulnSet.has(e.from) || vulnSet.has(e.to)
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
   🚀 GET GRAPH (ULTRA)
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

    /* =========================
       ⚡ Fetch Data
    ========================= */
    const [deps, vulns] = await Promise.all([
      Dependency.find({ repoId }).lean(),
      Vulnerability.find({ repoId }).lean()
    ]);

    const nodes = [];
    const edges = [];
    const nodeSet = new Set();

    /* =========================
       🟢 REPO NODE
    ========================= */
    nodes.push({
      id: repo._id.toString(),
      label: repo.name,
      type: "repo",
      size: 30
    });

    nodeSet.add(repo._id.toString());

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
      edges.push({
        from: repo._id.toString(),
        to: depId,
        type: "uses"
      });

      // dependency chain
      if (dep.parent) {
        edges.push({
          from: dep.parent,
          to: depId,
          type: "depends_on"
        });
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
      const vulnId = `${v.package}_${v.cve || Math.random()}`;

      severityCount[v.severity] = (severityCount[v.severity] || 0) + 1;

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

      edges.push({
        from: v.package,
        to: vulnId,
        type: "has_vulnerability"
      });
    });

    /* =========================
       💀 CHAINS (KILLER FEATURE)
    ========================= */
    const chains = findVulnerableChains(edges, vulns);

    /* =========================
       📊 STATS
    ========================= */
    const stats = {
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
    res.json({
      nodes,
      edges,
      chains,   // 🔥 frontend highlight karega
      stats     // 🔥 dashboard use karega
    });

  } catch (err) {
    console.log("❌ Graph Error:", err.message);

    res.status(500).json({
      error: "Graph generation failed"
    });
  }
};
