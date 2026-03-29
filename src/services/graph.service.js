export const buildGraph = (deps = [], vulns = [], repo = null) => {
  const nodes = [];
  const edges = [];

  const nodeSet = new Set();
  const edgeSet = new Set();

  /* =========================
     🧠 NORMALIZER (VERY IMPORTANT)
  ========================= */
  const normalize = (str) =>
    String(str || "").toLowerCase().trim();

  /* =========================
     🟢 REPO NODE
  ========================= */
  let repoId = null;

  if (repo?._id) {
    repoId = repo._id.toString();

    nodes.push({
      id: repoId,
      label: repo.name,
      type: "repo",
      size: 30
    });

    nodeSet.add(repoId);
  }

  /* =========================
     🟡 DEPENDENCIES
  ========================= */
  deps.forEach(dep => {
    if (!dep?.name) return;

    const depId = normalize(dep.name);

    /* ✅ ADD DEP NODE */
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

    /* 🔗 REPO → DEP */
    if (repoId) {
      const edgeKey = `${repoId}->${depId}`;

      if (!edgeSet.has(edgeKey)) {
        edges.push({
          from: repoId,
          to: depId,
          type: "uses"
        });
        edgeSet.add(edgeKey);
      }
    }

    /* 🔗 DEP → DEP (CHAIN) */
    if (dep.parent) {
      const parentId = normalize(dep.parent);

      // 🔥 ensure parent node exists
      if (!nodeSet.has(parentId)) {
        nodes.push({
          id: parentId,
          label: parentId,
          type: "dependency",
          size: 22,
          color: "#4da6ff"
        });
        nodeSet.add(parentId);
      }

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
     🔴 VULNERABILITIES
  ========================= */
  vulns.forEach(v => {
    if (!v?.package) return;

    const pkg = normalize(v.package);

    // 🔥 UNIQUE VULN ID FIX
    const vulnId = `${pkg}_${v.cve || v._id || Math.random()}`;

    /* 🔥 ENSURE DEP NODE EXISTS */
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

    /* ✅ ADD VULN NODE */
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

    /* 🔗 DEP → VULN */
    const edgeKey = `${pkg}->${vulnId}`;

    if (!edgeSet.has(edgeKey)) {
      edges.push({
        from: pkg,
        to: vulnId,
        type: "has_vulnerability"
      });
      edgeSet.add(edgeKey);
    }

    /* 💎 OPTIONAL: REPO → VULN DIRECT */
    if (repoId) {
      const repoEdgeKey = `${repoId}->${vulnId}`;

      if (!edgeSet.has(repoEdgeKey)) {
        edges.push({
          from: repoId,
          to: vulnId,
          type: "has_vulnerability"
        });
        edgeSet.add(repoEdgeKey);
      }
    }
  });

  /* =========================
     📊 STATS
  ========================= */
  const stats = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    dependencies: nodes.filter(n => n.type === "dependency").length,
    vulnerabilities: nodes.filter(n => n.type === "vulnerability").length,
    severity: {
      LOW: nodes.filter(n => n.severity === "LOW").length,
      MEDIUM: nodes.filter(n => n.severity === "MEDIUM").length,
      HIGH: nodes.filter(n => n.severity === "HIGH").length,
      CRITICAL: nodes.filter(n => n.severity === "CRITICAL").length
    }
  };

  return { nodes, edges, stats };
};
