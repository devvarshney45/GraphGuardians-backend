export const buildGraph = (deps = [], vulns = [], repo = null) => {
  const nodes = [];
  const edges = [];

  const nodeSet = new Set();
  const edgeSet = new Set(); // 🔥 duplicate edge prevent

  /* =========================
     🟢 REPO NODE
  ========================= */
  if (repo) {
    const repoId = repo._id.toString();

    nodes.push({
      id: repoId,
      label: repo.name,
      type: "repo",
      size: 30
    });

    nodeSet.add(repoId);
  }

  /* =========================
     🟡 DEPENDENCY NODES
  ========================= */
  deps.forEach(dep => {
    if (!dep?.name) return;

    const depId = dep.name.toLowerCase();

    // ✅ prevent duplicate nodes
    if (!nodeSet.has(depId)) {
      nodes.push({
        id: depId,
        label: `${dep.name}@${dep.version || "latest"}`,
        type: "dependency",
        size: 22,
        color: "#4da6ff"
      });

      nodeSet.add(depId);
    }

    // 🔗 repo → dependency
    if (repo) {
      const edgeKey = `${repo._id}->${depId}`;

      if (!edgeSet.has(edgeKey)) {
        edges.push({
          from: repo._id.toString(),
          to: depId,
          type: "uses"
        });
        edgeSet.add(edgeKey);
      }
    }

    // 🔗 dependency → dependency (CHAIN 🔥)
    if (dep.parent) {
      const parentId = dep.parent.toLowerCase();
      const edgeKey = `${parentId}->${depId}`;

      if (!edgeSet.has(edgeKey)) {
        edges.push({
          from: parentId,
          to: depId,
          type: "depends_on"
        });
        edgeSet.add(edgeKey);
      }
    }
  });

  /* =========================
     🔴 VULNERABILITY NODES
  ========================= */
  vulns.forEach(v => {
    if (!v?.package) return;

    const pkg = v.package.toLowerCase();
    const vulnId = `${pkg}_${v.cve || "vuln"}`;

    // 🔥 ensure dependency node exists (IMPORTANT FIX)
    if (!nodeSet.has(pkg)) {
      nodes.push({
        id: pkg,
        label: pkg,
        type: "dependency",
        size: 22,
        color: "#4da6ff"
      });
      nodeSet.add(pkg);
    }

    // ✅ prevent duplicate vuln nodes
    if (!nodeSet.has(vulnId)) {
      nodes.push({
        id: vulnId,
        label: v.cve || pkg,
        type: "vulnerability",
        severity: v.severity,
        size: 18,
        color:
          v.severity === "CRITICAL" ? "#ff0000" :
          v.severity === "HIGH" ? "#ff4d4d" :
          v.severity === "MEDIUM" ? "#ffa500" :
          "#ffff00"
      });

      nodeSet.add(vulnId);
    }

    // 🔗 dependency → vulnerability
    const edgeKey = `${pkg}->${vulnId}`;

    if (!edgeSet.has(edgeKey)) {
      edges.push({
        from: pkg,
        to: vulnId,
        type: "has_vulnerability"
      });

      edgeSet.add(edgeKey);
    }
  });

  /* =========================
     📊 STATS (BONUS 🔥)
  ========================= */
  const stats = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    dependencies: nodes.filter(n => n.type === "dependency").length,
    vulnerabilities: nodes.filter(n => n.type === "vulnerability").length
  };

  return { nodes, edges, stats };
};
