export const buildGraph = (deps, vulns, repo) => {
  const nodes = [];
  const edges = [];

  const nodeSet = new Set();

  // 🟢 Repo Node
  if (repo) {
    nodes.push({
      id: repo._id.toString(),
      label: repo.name,
      type: "repo"
    });
  }

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
    if (repo) {
      edges.push({
        from: repo._id.toString(),
        to: dep.name,
        type: "uses"
      });
    }

    // parent dependency chain (VERY IMPORTANT 🔥)
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

  return { nodes, edges };
};
