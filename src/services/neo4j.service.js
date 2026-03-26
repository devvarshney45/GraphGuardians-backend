import driver from "../config/neo4j.js";

export const pushToNeo4j = async (
  repoId,
  deps = [],
  vulns = [],
  depEdges = []
) => {
  const session = driver.session();

  try {
    console.log("🧠 Neo4j Sync Started");

    /* =========================
       🔥 SAFE DATA
    ========================= */
    const safeDeps = deps
      .filter(d => d && typeof d.name === "string")
      .map(d => ({
        name: String(d.name).toLowerCase().trim(),
        version: String(d.version || "unknown")
      }));

    const safeEdges = depEdges
      .filter(e => e && typeof e.from === "string" && typeof e.to === "string")
      .map(e => ({
        from: String(e.from).toLowerCase().trim(),
        to: String(e.to).toLowerCase().trim()
      }));

    const safeVulns = vulns
      .filter(v => v && typeof v.package === "string")
      .map(v => ({
        package: String(v.package).toLowerCase().trim(),
        id: String(v.cve || `${v.package}_unknown`),
        severity: String(v.severity || "UNKNOWN")
      }));

    /* =========================
       🧹 CLEAN OLD GRAPH
    ========================= */
    await session.run(
      `MATCH (r:Repo {id: $repoId})-[*]->(n) DETACH DELETE n`,
      { repoId: String(repoId) }
    );

    /* =========================
       🧱 CREATE REPO NODE
    ========================= */
    await session.run(
      `MERGE (r:Repo {id: $repoId})`,
      { repoId: String(repoId) }
    );

    /* =========================
       📦 CREATE ALL PACKAGES (BATCH)
    ========================= */
    await session.run(
      `
      UNWIND $deps AS dep
      MERGE (p:Package {name: dep.name})
      SET p.version = dep.version
      `,
      { deps: safeDeps }
    );

    /* =========================
       🔗 CONNECT REPO → PACKAGES
    ========================= */
    await session.run(
      `
      MATCH (r:Repo {id: $repoId})
      UNWIND $deps AS dep
      MATCH (p:Package {name: dep.name})
      MERGE (r)-[:USES]->(p)
      `,
      { repoId: String(repoId), deps: safeDeps }
    );

    /* =========================
       🔗 EDGES (SAFE + AUTO NODE)
    ========================= */
    await session.run(
      `
      UNWIND $edges AS edge
      MERGE (a:Package {name: edge.from})
      MERGE (b:Package {name: edge.to})
      MERGE (a)-[:DEPENDS_ON]->(b)
      `,
      { edges: safeEdges }
    );

    console.log(`🔗 Dependency edges inserted: ${safeEdges.length}`);

    /* =========================
       🚨 VULNERABILITIES (BATCH)
    ========================= */
    await session.run(
      `
      UNWIND $vulns AS v
      MATCH (p:Package {name: v.package})
      MERGE (vul:Vulnerability {id: v.id})
      SET vul.severity = v.severity
      MERGE (p)-[:HAS_VULN]->(vul)
      `,
      { vulns: safeVulns }
    );

    console.log(`🚨 Vulnerabilities linked: ${safeVulns.length}`);

    console.log("✅ Neo4j Sync Success");

  } catch (err) {
    console.log("❌ Neo4j Error:", err.message);
  } finally {
    await session.close();
  }
};
