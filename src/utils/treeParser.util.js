export const extractDependencyEdges = (tree) => {
  const edges = [];

  if (!tree || typeof tree !== "object") return edges;

  const root = String(tree.name || "root")
    .toLowerCase()
    .trim();

  const seen = new Set();

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

  const traverse = (node, parent) => {
    // 🔥 SAFETY CHECK
    if (
      !node ||
      typeof node !== "object" ||
      !node.dependencies ||
      typeof node.dependencies !== "object"
    ) {
      return;
    }

    for (const name in node.dependencies) {
      const dep = node.dependencies[name];

      // 🔥 STRICT VALIDATION
      if (!name || typeof name !== "string") continue;

      const child = name.toLowerCase().trim();

      if (!child || parent === child) continue;

      // ✅ edge add
      addEdge(parent, child);

      // 🔥 RECURSE ONLY IF SAFE OBJECT
      if (
        dep &&
        typeof dep === "object" &&
        !Array.isArray(dep)
      ) {
        traverse(dep, child);
      }
    }
  };

  /* =========================
     ROOT → FIRST LEVEL
  ========================= */
  if (tree.dependencies && typeof tree.dependencies === "object") {
    for (const name in tree.dependencies) {
      if (typeof name !== "string") continue;

      const child = name.toLowerCase().trim();

      if (child && child !== root) {
        addEdge(root, child);
      }
    }
  }

  /* =========================
     FULL TRAVERSE
  ========================= */
  traverse(tree, root);

  console.log(`🔗 Total edges generated: ${edges.length}`);

  return edges;
};
