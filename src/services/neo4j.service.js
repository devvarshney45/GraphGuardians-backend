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
       🧼 ULTRA SAFE CLEAN (CRITICAL 💀)
    ========================= */
    const cleanDeps = JSON.parse(JSON.stringify(deps || []))
      .filter(d => d?.name)
      .map(d => ({
        name: String(d.name).toLowerCase().trim(),
        version: String(d.version || "unknown")
      }));

    const cleanEdges = JSON.parse(JSON.stringify(depEdges || []))
      .filter(e => e?.from && e?.to)
      .map(e => ({
        from: String(e.from).toLowerCase().trim(),
        to: String(e.to).toLowerCase().trim()
      }));

    const cleanVulns = JSON.parse(JSON.stringify(vulns || []))
      .filter(v => v?.package)
      .map(v => ({
        package: String(v.package).toLowerCase().trim(),
        id: String(v.cve || `${v.package}_unknown`),
        severity: String(v.severity || "UNKNOWN")
      }));

    /* =========================
       🔥 ROOT DETECTION
    ========================= */
    const ROOT =
      cleanEdges.length > 0
        ? cleanEdges[0].from
        : cleanDeps[0]?.name || "root";

    /* =========================
       🧹 CLEAN OLD GRAPH
    ========================= */
    await session.run(
      `
      MATCH (r:Repo {id: $repoId})-[*]->(n)
      DETACH DELETE n
      `,
      { repoId }
    );

    /* =========================
       ✅ CREATE REPO
    ========================= */
    await session.run(
      `
      MERGE (r:Repo {id: $repoId})
      ON CREATE SET r.createdAt = timestamp()
      `,
      { repoId }
    );

    /* =========================
       ✅ ROOT NODE
    ========================= */
    await session.run(
      `
      MERGE (root:Package {name: $root})
      `,
      { root: ROOT }
    );

    /* =========================
       🔗 REPO → ROOT
    ========================= */
    await session.run(
      `
      MATCH (r:Repo {id: $repoId})
      MATCH (root:Package {name: $root})
      MERGE (r)-[:USES]->(root)
      `,
      { repoId, root: ROOT }
    );

    /* =========================
       📦 PACKAGES
    ========================= */
    if (cleanDeps.length > 0) {
      await session.run(
        `
        UNWIND $deps AS dep
        MERGE (p:Package {name: dep.name})
        SET p.version = dep.version
        `,
        { deps: cleanDeps }
      );
    }

    /* =========================
       🔗 DEPENDENCY EDGES
    ========================= */
    if (cleanEdges.length > 0) {
      await session.run(
        `
        UNWIND $edges AS edge
        MATCH (a:Package {name: edge.from})
        MATCH (b:Package {name: edge.to})
        MERGE (a)-[:DEPENDS_ON]->(b)
        `,
        { edges: cleanEdges }
      );
    }

    console.log(`🔗 Dependency edges inserted: ${cleanEdges.length}`);

    /* =========================
       🚨 VULNERABILITIES
    ========================= */
    if (cleanVulns.length > 0) {
      await session.run(
        `
        UNWIND $vulns AS v
        MATCH (p:Package {name: v.package})
        MERGE (vul:Vulnerability {id: v.id})
        SET vul.severity = v.severity
        MERGE (p)-[:HAS_VULN]->(vul)
        `,
        { vulns: cleanVulns }
      );
    }

    console.log(`🚨 Vulnerabilities linked: ${cleanVulns.length}`);

    console.log("✅ Neo4j Sync Success");

  } catch (err) {
    console.log("❌ Neo4j Error:", err.message);
  } finally {
    await session.close();
  }
};
