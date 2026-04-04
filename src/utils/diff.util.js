export const compareDependencies = (oldDeps = [], newDeps = []) => {
  const oldMap = new Map(oldDeps.map(d => [d.name, d.cleanVersion]));
  const newMap = new Map(newDeps.map(d => [d.name, d.cleanVersion]));

  const added = [];
  const removed = [];
  const updated = [];

  newMap.forEach((version, name) => {
    if (!oldMap.has(name)) {
      added.push({ name, version });
    } else if (oldMap.get(name) !== version) {
      updated.push({
        name,
        oldVersion: oldMap.get(name),
        newVersion: version
      });
    }
  });

  oldMap.forEach((version, name) => {
    if (!newMap.has(name)) {
      removed.push({ name, version });
    }
  });

  return { added, removed, updated };
};

export const findNewVulnerabilities = (oldVulns = [], newVulns = []) => {
  const oldSet = new Set(oldVulns.map(v => v.package + v.severity));

  return newVulns.filter(v => !oldSet.has(v.package + v.severity));
};

export const findFixedVulnerabilities = (oldVulns = [], newVulns = []) => {
  const newSet = new Set(newVulns.map(v => v.package + v.severity));

  return oldVulns.filter(v => !newSet.has(v.package + v.severity));
};

export const generateAlerts = (repoId, newVulns = [], fixedVulns = []) => {
  const alerts = [];

  newVulns.forEach(v => {
    alerts.push({
      repoId,
      type: "NEW_VULNERABILITY",
      message: `New vulnerability detected in ${v.package} (${v.severity})`,
      severity: v.severity,      // ✅ CRITICAL/HIGH/MEDIUM/LOW
      package: v.package
    });
  });

  fixedVulns.forEach(v => {
    alerts.push({
      repoId,
      type: "FIXED",
      message: `Vulnerability fixed in ${v.package}`,
      severity: "LOW",           // ✅ FIXED: "INFO" → "LOW" (model enum match)
      package: v.package
    });
  });

  return alerts;
};