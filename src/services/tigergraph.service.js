import axios from "axios";

const TG_URL = process.env.TG_URL;      // e.g. https://<host>:9000
const GRAPH = process.env.TG_GRAPH;    // graph name
const TOKEN = process.env.TG_TOKEN;    // RESTPP token

// 🧠 Helper: unique push
const pushUnique = (arr, item, key = "id") => {
  if (!arr.find(i => i[key] === item[key] && i.type === item.type)) {
    arr.push(item);
  }
};

export const pushToTigerGraph = async (repoId, deps, vulns) => {
  try {
    const vertices = [];
    const edges = [];

    // 🟢 Repo vertex
    pushUnique(vertices, {
      type: "Repo",
      id: repoId,
      attributes: {}
    });

    // 🟡 Dependencies
    deps.forEach(dep => {
      pushUnique(vertices, {
        type: "Package",
        id: dep.name,
        attributes: {
          version: dep.version
        }
      });

      edges.push({
        from_type: "Repo",
        from_id: repoId,
        to_type: "Package",
        to_id: dep.name,
        type: "uses",
        attributes: {}
      });

      // 🔗 parent chain (VERY IMPORTANT)
      if (dep.parent) {
        edges.push({
          from_type: "Package",
          from_id: dep.parent,
          to_type: "Package",
          to_id: dep.name,
          type: "depends_on",
          attributes: {}
        });
      }
    });

    // 🔴 Vulnerabilities
    vulns.forEach(v => {
      const vulnId = `${v.package}_${v.cve || "vuln"}`;

      pushUnique(vertices, {
        type: "Vulnerability",
        id: vulnId,
        attributes: {
          severity: v.severity
        }
      });

      edges.push({
        from_type: "Package",
        from_id: v.package,
        to_type: "Vulnerability",
        to_id: vulnId,
        type: "has_vulnerability",
        attributes: {
          severity: v.severity
        }
      });
    });

    // 🚀 TigerGraph RESTPP Upsert
    const endpoint = `${TG_URL}/graph/${GRAPH}`;

    await axios.post(
      endpoint,
      {
        vertices: vertices.reduce((acc, v) => {
          if (!acc[v.type]) acc[v.type] = {};
          acc[v.type][v.id] = v.attributes || {};
          return acc;
        }, {}),
        edges: edges.reduce((acc, e) => {
          if (!acc[e.from_type]) acc[e.from_type] = {};
          if (!acc[e.from_type][e.type]) acc[e.from_type][e.type] = {};
          if (!acc[e.from_type][e.type][e.from_id]) {
            acc[e.from_type][e.type][e.from_id] = {};
          }
          if (!acc[e.from_type][e.type][e.from_id][e.to_type]) {
            acc[e.from_type][e.type][e.from_id][e.to_type] = {};
          }

          acc[e.from_type][e.type][e.from_id][e.to_type][e.to_id] =
            e.attributes || {};

          return acc;
        }, {})
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`
        }
      }
    );

    console.log("🔥 TigerGraph sync success");

  } catch (err) {
    console.log("❌ TigerGraph error:", err.response?.data || err.message);
  }
};
