import Dependency from "../models/dependency.model.js";
import Vulnerability from "../models/vulnerability.model.js";
import Repo from "../models/repo.model.js";

export const getGraph = async (req, res) => {
  try {
    const { repoId } = req.params;

    const repo = await Repo.findById(repoId);

    const deps = await Dependency.find({ repoId });
    const vulns = await Vulnerability.find({ repoId });

    const nodes = [];
    const edges = [];

    // 🟢 Repo node
    nodes.push({
      id: repo._id.toString(),
      label: repo.name,
      type: "repo"
    });

    // 🟡 Dependency nodes
    deps.forEach(dep => {
      nodes.push({
        id: dep.name,
        label: dep.name,
        type: "dependency"
      });

      edges.push({
        from: repo._id.toString(),
        to: dep.name,
        type: "uses"
      });
    });

    // 🔴 Vulnerability nodes
    vulns.forEach(v => {
      const vulnId = v.package + "_vuln";

      nodes.push({
        id: vulnId,
        label: v.package,
        type: "vulnerability",
        severity: v.severity
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
