import axios from "axios";

const TG_URL = process.env.TG_URL;
const GRAPH = process.env.TG_GRAPH;
const API_KEY = process.env.TG_API_KEY;

export const pushToTigerGraph = async (repoId, deps = [], vulns = []) => {
  try {
    console.log("\n🧠 ===============================");
    console.log("🧠 TigerGraph Sync Started");
    console.log("==================================");

    console.log("🔑 API KEY:", API_KEY);

    const vertices = {};
    const edges = {};

    /* Repo */
    vertices["Repo"] = {
      [repoId]: { name: repoId }
    };

    /* Dependencies */
    vertices["Package"] = {};
    edges["uses"] = {};

    deps.forEach(dep => {
      if (!dep.name) return;

      vertices["Package"][dep.name] = {
        name: dep.name,
        version: dep.cleanVersion || dep.version || "unknown"
      };

      if (!edges["uses"][repoId]) edges["uses"][repoId] = {};
      edges["uses"][repoId][dep.name] = {};
    });

    /* Vulnerabilities */
    vertices["Vulnerability"] = {};
    edges["has_vulnerability"] = {};

    vulns.forEach(v => {
      if (!v.package) return;

      const id = `${v.package}_${v.cve || "NA"}`;

      vertices["Vulnerability"][id] = {
        id,
        severity: v.severity || "UNKNOWN"
      };

      if (!edges["has_vulnerability"][v.package]) {
        edges["has_vulnerability"][v.package] = {};
      }

      edges["has_vulnerability"][v.package][id] = {
        severity: v.severity || "UNKNOWN"
      };
    });

    /* 🚀 FINAL CALL (API KEY BASED) */

    const endpoint = `${TG_URL}/restpp/graph/${GRAPH}`;

    console.log("📡 Sending to:", endpoint);

    const res = await axios.post(
      endpoint,
      { vertices, edges },
      {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY
        }
      }
    );

    console.log("✅ TigerGraph sync success");
    console.log(JSON.stringify(res.data, null, 2));
    console.log("==================================\n");

  } catch (err) {
    console.log("\n❌ TigerGraph error:");
    console.log(err.response?.data || err.message);
    console.log("==================================\n");
  }
};