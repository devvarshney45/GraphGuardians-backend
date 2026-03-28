import axios from "axios";

const TG_URL = process.env.TG_URL;
const GRAPH = process.env.TG_GRAPH;
const TOKEN = process.env.TG_TOKEN;

export const pushToTigerGraph = async (repoId, deps = [], vulns = []) => {
  try {
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

    const endpoint = `${TG_URL}/restpp/graph/${GRAPH}?access_token=${TOKEN}`;

    const res = await axios.post(endpoint, { vertices, edges });

    console.log("✅ TigerGraph Success");
    console.log(res.data);

  } catch (err) {
    console.log("❌ TG Error:", err.response?.data || err.message);
  }
};
