export const buildGraph = (deps, vulns, repoId) => {
  const nodes = [];
  const edges = [];
  const nodeSet = new Set();

  const repoIdStr = String(repoId); // 🔥 FIX

  // 🟢 Repo Node
  nodes.push({
    id: repoIdStr,
    label: "Repository",
    type: "repo"
  });

  // 🟡 Dependencies
  deps.forEach(dep => {
    const depName = String(dep.name);

    if (!nodeSet.has(depName)) {
      nodes.push({
        id: depName,
        label: `${depName}@${dep.cleanVersion || dep.version || ""}`,
        type: "dependency",
        depType: String(dep.type || "prod")
      });
      nodeSet.add(depName);
    }

    edges.push({
      from: repoIdStr,
      to: depName,
      type: "uses"
    });

    if (dep.parent) {
      edges.push({
        from: String(dep.parent),
        to: depName,
        type: "depends_on"
      });
    }
  });

  // 🔴 Vulnerabilities
  vulns.forEach(v => {
    const pkg = String(v.package);
    const vulnId = `${pkg}_${v.cve || "vuln"}`;

    nodes.push({
      id: vulnId,
      label: pkg,
      type: "vulnerability",
      severity: String(v.severity || "LOW"),
      color:
        v.severity === "CRITICAL" ? "#ff0000" :
        v.severity === "HIGH" ? "#ff4d4d" :
        v.severity === "MEDIUM" ? "#ffa500" :
        "#ffff00"
    });

    edges.push({
      from: pkg,
      to: vulnId,
      type: "has_vulnerability"
    });
  });

  return { nodes, edges };
};
