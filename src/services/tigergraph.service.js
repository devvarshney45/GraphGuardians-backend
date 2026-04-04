import axios from "axios";

const HOST  = process.env.TIGERGRAPH_HOST  || "https://tg-5b458e5a-0643-4a92-8518-66f5264f84f2.tg-2635877100.i.tgcloud.io";
const GRAPH = process.env.TIGERGRAPH_GRAPH || "dev";
const TOKEN = process.env.TIGERGRAPH_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2YXJzaG5leWRldjM2NUBnbWFpbC5jb20iLCJpYXQiOjE3NzQ2MDI1NTUsImV4cCI6MTc4MjM3ODU2MCwiaXNzIjoiVGlnZXJHcmFwaCJ9.CUJHVsI4KPBj6NhEpgGP0pPZBxNfsvu3xTxRSEsn9sI";

/* =========================
   📦 PUSH DATA TO TIGERGRAPH
========================= */
export const pushToTigerGraph = async (
  repoId,
  deps = [],
  vulns = [],
  depEdges = []
) => {
  try {
    console.log("🧠 TigerGraph Sync Start");

    const processed = new Set();

    for (const dep of deps) {
      const depKey = `${dep.name}@${dep.version}`;
      if (processed.has(depKey)) continue;
      processed.add(depKey);

      const relatedVulns = vulns.filter(v => v.package === dep.name);

      if (relatedVulns.length === 0) {
        const url =
          `${HOST}/restpp/query/${GRAPH}/insertDynamicData` +
          `?repoId=${encodeURIComponent(repoId)}` +
          `&dep=${encodeURIComponent(dep.name)}` +
          `&ver=${encodeURIComponent(dep.version || "unknown")}` +
          `&vuln=${encodeURIComponent("NA")}` +
          `&severity=${encodeURIComponent("LOW")}` +
          `&description=${encodeURIComponent("No vulnerability")}`;

        await axios.post(url, null, {
          headers: { Authorization: `Bearer ${TOKEN}` },
          timeout: 8000
        });
      }

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

        await axios.post(url, null, {
          headers: { Authorization: `Bearer ${TOKEN}` },
          timeout: 8000
        });
      }
    }

    /* ========================= DEP CHAIN EDGES ========================= */
    if (depEdges.length > 0) {
      console.log("🔗 Pushing dependency chains...");

      const chainSet = new Set();

      for (const edge of depEdges) {
        const key = `${edge.from}->${edge.to}`;
        if (chainSet.has(key)) continue;
        chainSet.add(key);

        // ✅ FIXED: from_dep aur to_dep use karo
        const url =
          `${HOST}/restpp/query/${GRAPH}/insertDependencyChain` +
          `?from_dep=${encodeURIComponent(edge.from)}` +
          `&to_dep=${encodeURIComponent(edge.to)}`;

        await axios.post(url, null, {
          headers: { Authorization: `Bearer ${TOKEN}` },
          timeout: 8000
        });
      }
    }

    console.log("🎉 TigerGraph Sync Complete");

  } catch (err) {
    console.log("❌ TG Push Error:", err.response?.data || err.message);
  }
};

/* =========================
   🔗 GET CHAIN FROM TIGERGRAPH
========================= */
export const getChainFromTigerGraph = async (repoId) => {
  try {
    const url =
      `${HOST}/restpp/query/${GRAPH}/getDependencyChain` +
      `?repoId=${encodeURIComponent(repoId)}`;

    console.log("🔗 Fetching TG chain:", url);

    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      timeout: 10000
    });

    console.log("📦 TG raw response:", JSON.stringify(res.data?.results?.[0]).slice(0, 300));

    const results = res.data?.results?.[0]?.edges || [];

    return results.map(e => ({
      from: e.from_id || e.from,
      to:   e.to_id   || e.to
    })).filter(e => e.from && e.to);

  } catch (err) {
    console.log("❌ TG chain fetch error:", err.response?.data || err.message);
    throw err;
  }
};