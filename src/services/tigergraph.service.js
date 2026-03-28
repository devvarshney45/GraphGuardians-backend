import axios from "axios";

const TG_URL = process.env.TG_URL;
const GRAPH = process.env.TG_GRAPH;
const TOKEN = process.env.TG_API_KEY; // ✅ FIXED

export const pushToTigerGraph = async (repoId, deps = [], vulns = []) => {
  try {
    console.log("🧠 TigerGraph Sync Start");

    if (!TOKEN) {
      console.log("❌ Missing TG_API_KEY");
      return;
    }

    const vertices = {};
    const edges = {};

    /* =========================
       📦 REPO
    ========================= */
    vertices["Repo"] = {
      [repoId]: { name: repoId }
    };

    /* =========================
       📦 DEPENDENCIES
    ========================= */
    vertices["Dependency"] = {};
    edges["HAS_DEPENDENCY"] = {};

    deps.forEach(dep => {
      if (!dep.name) return;

      vertices["Dependency"][dep.name] = {
        version: dep.version || "unknown"
      };

      if (!edges["HAS_DEPENDENCY"][repoId]) {
        edges["HAS_DEPENDENCY"][repoId] = {};
      }

      edges["HAS_DEPENDENCY"][repoId][dep.name] = {};
    });

    /* =========================
       🚨 VULNERABILITIES
    ========================= */
    vertices["Vulnerability"] = {};
    edges["HAS_VULNERABILITY"] = {};

    vulns.forEach(v => {
      if (!v.package) return;

      const vulnId = v.cve || `${v.package}_NA`;

      vertices["Vulnerability"][vulnId] = {
        severity: v.severity,
        description: v.description || ""
      };

      if (!edges["HAS_VULNERABILITY"][v.package]) {
        edges["HAS_VULNERABILITY"][v.package] = {};
      }

      edges["HAS_VULNERABILITY"][v.package][vulnId] = {};
    });

    /* =========================
       🚀 API CALL
    ========================= */
    const endpoint = `${TG_URL}/restpp/graph/${GRAPH}?access_token=${encodeURIComponent(TOKEN)}`;

    console.log("📡 Sending to:", endpoint);

    const res = await axios.post(endpoint, { vertices, edges });

    console.log("✅ TigerGraph Success");
    console.log(JSON.stringify(res.data, null, 2));

  } catch (err) {
    console.log("❌ TG Error:", err.response?.data || err.message);
  }
};
