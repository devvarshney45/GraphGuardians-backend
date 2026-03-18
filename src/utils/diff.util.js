/* =========================================
   🔍 COMPARE DEPENDENCIES
========================================= */

export const compareDependencies = (oldDeps = [], newDeps = []) => {
  const oldMap = new Map(oldDeps.map(d => [d.name, d.cleanVersion]));
  const newMap = new Map(newDeps.map(d => [d.name, d.cleanVersion]));

  const added = [];
  const removed = [];
  const updated = [];

  // ➕ added / 🔁 updated
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

  // ❌ removed
  oldMap.forEach((version, name) => {
    if (!newMap.has(name)) {
      removed.push({ name, version });
    }
  });

  return { added, removed, updated };
};

/* =========================================
   🚨 DETECT NEW VULNERABILITIES
========================================= */

export const findNewVulnerabilities = (oldVulns = [], newVulns = []) => {
  const oldSet = new Set(oldVulns.map(v => v.package + v.severity));

  const newIssues = [];

  newVulns.forEach(v => {
    const key = v.package + v.severity;

    if (!oldSet.has(key)) {
      newIssues.push(v);
    }
  });

  return newIssues;
};

/* =========================================
   ✅ FIXED VULNERABILITIES
========================================= */

export const findFixedVulnerabilities = (oldVulns = [], newVulns = []) => {
  const newSet = new Set(newVulns.map(v => v.package + v.severity));

  const fixed = [];

  oldVulns.forEach(v => {
    const key = v.package + v.severity;

    if (!newSet.has(key)) {
      fixed.push(v);
    }
  });

  return fixed;
};

/* =========================================
   🔥 GENERATE ALERTS (IMPORTANT)
========================================= */

export const generateAlerts = (repoId, newVulns, fixedVulns) => {
  const alerts = [];

  newVulns.forEach(v => {
    alerts.push({
      repoId,
      message: `🚨 New vulnerability detected in ${v.package} (${v.severity})`,
      severity: v.severity
    });
  });

  fixedVulns.forEach(v => {
    alerts.push({
      repoId,
      message: `✅ Vulnerability fixed in ${v.package}`,
      severity: "INFO"
    });
  });

  return alerts;
};
