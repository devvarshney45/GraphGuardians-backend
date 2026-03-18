export const buildGraph = (deps, vulns) => {
  const nodes = [];
  const edges = [];

  deps.forEach(dep => {
    nodes.push({ id: dep.name, type: "dependency" });
  });

  vulns.forEach(v => {
    nodes.push({ id: v.package + "_vuln", type: "vulnerability" });

    edges.push({
      from: v.package,
      to: v.package + "_vuln"
    });
  });

  return { nodes, edges };
};