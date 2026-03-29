import axios from "axios";

// ✅ DIRECT VALUES (UNCHANGED)
const HOST = "https://tg-5b458e5a-0643-4a92-8518-66f5264f84f2.tg-2635877100.i.tgcloud.io";
const GRAPH = "dev";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2YXJzaG5leWRldjM2NUBnbWFpbC5jb20iLCJpYXQiOjE3NzQ2MDI1NTUsImV4cCI6MTc4MjM3ODU2MCwiaXNzIjoiVGlnZXJHcmFwaCJ9.CUJHVsI4KPBj6NhEpgGP0pPZBxNfsvu3xTxRSEsn9sI";

// 🔥 UPDATED FUNCTION
export const pushToTigerGraph = async (
  repoId,
  deps = [],
  vulns = [],
  depEdges = [] // ✅ NEW (optional, backward compatible)
) => {
  try {
    console.log("🧠 TigerGraph Sync Start");

    const processed = new Set(); // 🔥 duplicate avoid

    for (const dep of deps) {
      const depKey = `${dep.name}@${dep.version}`;

      if (processed.has(depKey)) continue;
      processed.add(depKey);

      const relatedVulns = vulns.filter(v => v.package === dep.name);

      /* =========================
         📦 NO VULNERABILITY CASE
      ========================= */
      if (relatedVulns.length === 0) {
        const url =
          `${HOST}/restpp/query/${GRAPH}/insertDynamicData` +
          `?repoId=${encodeURIComponent(repoId)}` +
          `&dep=${encodeURIComponent(dep.name)}` +
          `&ver=${encodeURIComponent(dep.version || "unknown")}` +
          `&vuln=${encodeURIComponent("NA")}` +
          `&severity=${encodeURIComponent("LOW")}` +
          `&description=${encodeURIComponent("No vulnerability")}`;

        console.log("🚀 URL:", url);

        const res = await axios.post(url, null, {
          headers: {
            Authorization: `Bearer ${TOKEN}`
          }
        });

        console.log("✅ TG Response:", res.data);
      }

      /* =========================
         🚨 VULNERABILITIES
      ========================= */
      for (const v of relatedVulns) {
        const vulnId = v.cve || `${dep.name}_NA`;

        const url =
          `${HOST}/restpp/query/${GRAPH}/insertDynamicData` +
          `?repoId=${encodeURIComponent(repoId)}` +
          `&dep=${encodeURIComponent(dep.name)}` +
          `&ver=${encodeURIComponent(dep.version || "unknown")}` +
          `&vuln=${encodeURIComponent(vulnId)}` +
          `&severity=${encodeURIComponent(v.severity || "MEDIUM")}` +
          `&description=${encodeURIComponent(v.description || "")}`;

        console.log("🚀 URL:", url);

        const res = await axios.post(url, null, {
          headers: {
            Authorization: `Bearer ${TOKEN}`
          }
        });

        console.log("✅ TG Response:", res.data);
      }
    }

    /* =========================
       🔥 DEP → DEP CHAIN (NEW)
    ========================= */
    if (depEdges.length > 0) {
      console.log("🔗 Pushing dependency chains...");

      const chainSet = new Set();

      for (const edge of depEdges) {
        const key = `${edge.from}->${edge.to}`;
        if (chainSet.has(key)) continue;
        chainSet.add(key);

        const url =
          `${HOST}/restpp/query/${GRAPH}/insertDependencyChain` +
          `?from=${encodeURIComponent(edge.from)}` +
          `&to=${encodeURIComponent(edge.to)}`;

        console.log("🔗 Chain URL:", url);

        const res = await axios.post(url, null, {
          headers: {
            Authorization: `Bearer ${TOKEN}`
          }
        });

        console.log("✅ Chain Response:", res.data);
      }
    }

    console.log("🎉 TigerGraph Sync Complete");

  } catch (err) {
    console.log("❌ TG Error:", err.response?.data || err.message);
  }
};
