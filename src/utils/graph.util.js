/* =========================================
   🧬 BUILD GRAPH (MAIN FUNCTION)
========================================= */

export const buildGraph = (deps, vulns, repoId) => {
  const nodes = [];
  const edges = [];
  const nodeSet = new Set();

  // 🟢 Repo Node
  nodes.push({
    id: repoId,
    label: "Repository",
    type: "repo"
  });

  // 🟡 Dependencies
  deps.forEach(dep => {
    if (!nodeSet.has(dep.name)) {
      nodes.push({
        id: dep.name,
        label: `${dep.name}@${dep.cleanVersion}`,
        type: "dependency",
        depType: dep.type
      });
      nodeSet.add(dep.name);
    }

    edges.push({
      from: repoId,
      to: dep.name,
      type: "uses"
    });

    // 🔥 dependency chain
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

/* =========================================
   🔥 GET VULNERABLE PATHS (VERY IMPORTANT)
========================================= */

export const getVulnerablePaths = (graph) => {
  const paths = [];

  graph.edges.forEach(edge => {
    if (edge.type === "has_vulnerability") {
      paths.push({
        dependency: edge.from,
        vulnerability: edge.to
      });
    }
  });

  return paths;
};

/* =========================================
   🧠 FIND CRITICAL DEPENDENCIES
========================================= */

export const getCriticalDependencies = (vulns) => {
  return vulns
    .filter(v => v.severity === "CRITICAL")
    .map(v => v.package);
};

/* =========================================
   📊 GRAPH SUMMARY (DASHBOARD USE)
========================================= */

export const getGraphStats = (deps, vulns) => {
  return {
    totalDependencies: deps.length,
    totalVulnerabilities: vulns.length,
    critical: vulns.filter(v => v.severity === "CRITICAL").length,
    high: vulns.filter(v => v.severity === "HIGH").length,
    medium: vulns.filter(v => v.severity === "MEDIUM").length,
    low: vulns.filter(v => v.severity === "LOW").length
  };
};
