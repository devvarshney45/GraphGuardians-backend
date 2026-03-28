import axios from "axios";

// ✅ DIRECT VALUES (jaise tu bola)
const HOST = "https://tg-5b458e5a-0643-4a92-8518-66f5264f84f2.tg-2635877100.i.tgcloud.io";
const GRAPH = "dev";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ2YXJzaG5leWRldjM2NUBnbWFpbC5jb20iLCJpYXQiOjE3NzQ2MDI1NTUsImV4cCI6MTc4MjM3ODU2MCwiaXNzIjoiVGlnZXJHcmFwaCJ9.CUJHVsI4KPBj6NhEpgGP0pPZBxNfsvu3xTxRSEsn9sI";

export const pushToTigerGraph = async (repoId, deps = [], vulns = []) => {
  try {
    console.log("🧠 TigerGraph Sync Start");

    for (const dep of deps) {
      const relatedVulns = vulns.filter(v => v.package === dep.name);

      // 👉 agar vuln nahi bhi hai tab bhi ek baar push kar
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

      // 👉 vulnerabilities ke liye
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

    console.log("🎉 TigerGraph Sync Complete");

  } catch (err) {
    console.log("❌ TG Error:", err.response?.data || err.message);
  }
};
