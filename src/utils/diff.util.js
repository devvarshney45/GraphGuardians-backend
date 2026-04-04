/* =========================
   🔍 COMPARE DEPENDENCIES
========================= */
export const compareDependencies = (oldDeps = [], newDeps = []) => {
  const oldMap = new Map(oldDeps.map(d => [d.name, d.version]));
  const newMap = new Map(newDeps.map(d => [d.name, d.version]));

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

/* =========================
   🆕 NEW VULNERABILITIES (FIXED 🔥)
========================= */
export const findNewVulnerabilities = (oldVulns = [], newVulns = []) => {
  const oldSet = new Set(
    oldVulns.map(v => `${v.package}-${v.cve || "no-cve"}-${v.version}`)
  );

  return newVulns.filter(
    v => !oldSet.has(`${v.package}-${v.cve || "no-cve"}-${v.version}`)
  );
};

/* =========================
   ✅ FIXED VULNERABILITIES (FIXED 🔥)
========================= */
export const findFixedVulnerabilities = (oldVulns = [], newVulns = []) => {
  const newSet = new Set(
    newVulns.map(v => `${v.package}-${v.cve || "no-cve"}-${v.version}`)
  );

  return oldVulns.filter(
    v => !newSet.has(`${v.package}-${v.cve || "no-cve"}-${v.version}`)
  );
};

/* =========================
   🚨 GENERATE ALERTS (ENHANCED 🔥)
========================= */
export const generateAlerts = (repoId, newVulns = [], fixedVulns = []) => {
  const alerts = [];

  newVulns.forEach(v => {
    alerts.push({
      repoId,
      type: "NEW_VULNERABILITY",
      message: `🚨 ${v.package}@${v.version} has ${v.severity} vulnerability`,
      severity: v.severity,
      package: v.package,
      cve: v.cve || null
    });
  });

  fixedVulns.forEach(v => {
    alerts.push({
      repoId,
      type: "FIXED",
      message: `✅ ${v.package}@${v.version} vulnerability resolved`,
      severity: "LOW",
      package: v.package,
      cve: v.cve || null
    });
  });

  return alerts;
};
