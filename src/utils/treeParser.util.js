export const extractDependencyEdges = (tree) => {
  const edges = [];
  const seen = new Set();

  if (!tree) return edges;

  const addEdge = (from, to) => {
    if (!from || !to) return;
    const f = String(from).toLowerCase().trim();
    const t = String(to).toLowerCase().trim();
    if (!f || !t || f === t) return;
    const key = `${f}->${t}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ from: f, to: t });
    }
  };

  // ✅ FIXED: array format handle karo (dependencyTree.service.js ka output)
  if (Array.isArray(tree)) {
    tree.forEach(dep => {
      if (!dep?.name) return;
      const to = dep.name.toLowerCase().trim();

      if (dep.parent) {
        // transitive dep — parent → child
        addEdge(dep.parent.toLowerCase().trim(), to);
      }
    });

    console.log(`🔗 Total edges generated: ${edges.length}`);
    return edges;
  }

  // ✅ Object format bhi handle karo (fallback)
  if (typeof tree !== "object") return edges;

  const root = String(tree.name || "root").toLowerCase().trim();

  const traverse = (node, parent) => {
    if (
      !node ||
      typeof node !== "object" ||
      !node.dependencies ||
      typeof node.dependencies !== "object"
    ) return;

    for (const name in node.dependencies) {
      const dep = node.dependencies[name];
      if (!name || typeof name !== "string") continue;
      const child = name.toLowerCase().trim();
      if (!child || parent === child) continue;
      addEdge(parent, child);
      if (dep && typeof dep === "object" && !Array.isArray(dep)) {
        traverse(dep, child);
      }
    }
  };

  if (tree.dependencies && typeof tree.dependencies === "object") {
    for (const name in tree.dependencies) {
      if (typeof name !== "string") continue;
      const child = name.toLowerCase().trim();
      if (child && child !== root) addEdge(root, child);
    }
  }

  traverse(tree, root);

  console.log(`🔗 Total edges generated: ${edges.length}`);
  return edges;
};