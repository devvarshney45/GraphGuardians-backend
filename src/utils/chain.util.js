export const findVulnerableChains = (edges, vulns) => {
  const vulnSet = new Set(vulns.map(v => v.package));

  return edges.map(e => ({
    ...e,
    isChain: vulnSet.has(e.from) || vulnSet.has(e.to)
  }));
};
