import axios from "axios";

const TG_URL = "https://your-tigergraph-endpoint";
const TOKEN = "your_token";

export const pushToTigerGraph = async (repoId, deps, vulns) => {
  try {
    const vertices = [];
    const edges = [];

    // repo node
    vertices.push({
      type: "Repo",
      id: repoId
    });

    deps.forEach(dep => {
      vertices.push({ type: "Package", id: dep.name });

      edges.push({
        from_type: "Repo",
        from_id: repoId,
        to_type: "Package",
        to_id: dep.name,
        type: "uses"
      });
    });

    vulns.forEach(v => {
      vertices.push({ type: "Vulnerability", id: v.package + "_vuln" });

      edges.push({
        from_type: "Package",
        from_id: v.package,
        to_type: "Vulnerability",
        to_id: v.package + "_vuln",
        type: "has_vulnerability"
      });
    });

    await axios.post(`${TG_URL}/graph`, { vertices, edges }, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });

  } catch (err) {
    console.log("TigerGraph error", err.message);
  }
};