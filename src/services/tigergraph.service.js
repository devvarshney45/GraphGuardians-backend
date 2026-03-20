import axios from "axios";

const TG_URL = process.env.TG_URL;
const GRAPH = process.env.TG_GRAPH;
const API_KEY = process.env.TG_API_KEY;

export const pushToTigerGraph = async (repoId, deps = [], vulns = []) => {
  try {
    console.log("\n🧠 ===============================");
    console.log("🧠 TigerGraph Sync Started");
    console.log("==================================");

    console.log("🔑 API KEY:", API_KEY ? "Loaded ✅" : "Missing ❌");

    if (!API_KEY) {
      throw new Error("TigerGraph API key missing");
    }

    const vertices = {};
    const edges = {};

    /* =========================
       📦 REPO
    ========================= */
    vertices["Repo"] = {
      [repoId]: {
        name: repoId
      }
    };

    /* =========================
       📦 PACKAGES
    ========================= */
    vertices["Package"] = {};
    edges["Repo"] = {
      uses: {}
    };

    deps.forEach(dep => {
      if (!dep.name) return;

      vertices["Package"][dep.name] = {
        name: dep.name,
        version: dep.cleanVersion || dep.version || "unknown"
      };

      if (!edges["Repo"]["uses"][repoId]) {
        edges["Repo"]["uses"][repoId] = {
          Package: {}
        };
      }

      edges["Repo"]["uses"][repoId]["Package"][dep.name] = {};
    });

    /* =========================
       🚨 VULNERABILITIES
    ========================= */
    vertices["Vulnerability"] = {};
    edges["Package"] = {
      has_vulnerability: {}
    };

    vulns.forEach(v => {
      if (!v.package) return;

      const vulnId = `${v.package}_${v.cve || "NA"}`;

      vertices["Vulnerability"][vulnId] = {
        severity: v.severity || "UNKNOWN"
      };

      if (!edges["Package"]["has_vulnerability"][v.package]) {
        edges["Package"]["has_vulnerability"][v.package] = {
          Vulnerability: {}
        };
      }

      edges["Package"]["has_vulnerability"][v.package]["Vulnerability"][vulnId] = {
        severity: v.severity || "UNKNOWN"
      };
    });

    /* =========================
       🚀 FINAL API CALL (FIXED)
    ========================= */

    // 🔥 IMPORTANT: encode token
    const encodedToken = encodeURIComponent(API_KEY);

    const endpoint = `${TG_URL}/restpp/graph/${GRAPH}?access_token=${encodedToken}`;

    console.log("📡 Sending to:", endpoint);
    console.log("📦 Vertices:", Object.keys(vertices).length);

    const res = await axios.post(
      endpoint,
      { vertices, edges },
      {
        headers: {
          "Content-Type": "application/json"
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