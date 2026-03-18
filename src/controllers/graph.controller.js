import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Repo from "../models/repo.model.js";

export const getGraph = async (req, res) => {
  try {
    const { repoId } = req.params;

    // 🔍 Repo check
    const repo = await Repo.findById(repoId).lean();
    if (!repo) {
      return res.status(404).json({ msg: "Repo not found" });
    }

    // 🔐 Ownership check
    if (repo.userId.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Unauthorized" });
    }

    // ⚡ Parallel fetch
    const [deps, vulns] = await Promise.all([
      Dependency.find({ repoId }).lean(),
      Vulnerability.find({ repoId }).lean()
    ]);

    const nodes = [];
    const edges = [];
    const nodeSet = new Set();

    // 🟢 Repo node
    nodes.push({
      id: repo._id.toString(),
      label: repo.name,
      type: "repo"
    });

    // 🟡 Dependencies
    deps.forEach(dep => {
      if (!nodeSet.has(dep.name)) {
        nodes.push({
          id: dep.name,
          label: `${dep.name}@${dep.version}`,
          type: "dependency"
        });
        nodeSet.add(dep.name);
      }

      // repo → dependency
      edges.push({
        from: repo._id.toString(),
        to: dep.name,
        type: "uses"
      });

      // 🔥 dependency chain (IMPORTANT)
      if (dep.parent) {
        edges.push({
          from: dep.parent,
          to: dep.name,
          type: "depends_on"
        });
      }
    });

    // 🔴 Vulnerabilities
    vulns.forEach(v => {
      const vulnId = `${v.package}_${v.cve || "vuln"}`;

      nodes.push({
        id: vulnId,
        label: v.package,
        type: "vulnerability",
        severity: v.severity,
        color:
          v.severity === "CRITICAL" ? "#ff0000" :
          v.severity === "HIGH" ? "#ff4d4d" :
          v.severity === "MEDIUM" ? "#ffa500" :
          "#ffff00"
      });

      edges.push({
        from: v.package,
        to: vulnId,
        type: "has_vulnerability"
      });
    });

    res.json({
      nodes,
      edges
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
