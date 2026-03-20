export const extractDependencyEdges = (tree) => {
  const edges = [];

  if (!tree || !tree.dependencies) return edges;

  // 🔥 normalize root
  const root = (tree.name || "root").toLowerCase().trim();

  const seen = new Set(); // ✅ avoid duplicates

  const addEdge = (from, to) => {
    const key = `${from}->${to}`;

    if (!seen.has(key)) {
      seen.add(key);

      edges.push({
        from,
        to
      });
    }
  };

  const traverse = (node, parent) => {
    if (!node || !node.dependencies) return;

    for (const [name, dep] of Object.entries(node.dependencies)) {
      const child = name.toLowerCase().trim();

      // ❌ skip invalid/self
      if (!child || parent === child) continue;

      // ✅ add edge
      addEdge(parent, child);

      // 🔁 recursive
      traverse(dep, child);
    }
  };

  /* =========================
     🔥 ROOT → FIRST LEVEL FIX
  ========================= */
  for (const [name] of Object.entries(tree.dependencies)) {
    const child = name.toLowerCase().trim();

    if (child && child !== root) {
      addEdge(root, child);
    }
  }

  /* =========================
     🔁 FULL TREE TRAVERSE
  ========================= */
  traverse(tree, root);

  console.log(`🔗 Total edges generated: ${edges.length}`);

  return edges;
};