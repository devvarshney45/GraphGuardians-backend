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
       🧼 NORMALIZE DATA
    ========================= */
    const cleanDeps = deps.map(d => ({
      name: d.name?.toLowerCase().trim(),
      version: d.version
    }));

    const cleanEdges = depEdges.map(e => ({
      from: e.from?.toLowerCase().trim(),
      to: e.to?.toLowerCase().trim()
    }));

    const cleanVulns = vulns.map(v => ({
      package: v.package?.toLowerCase().trim(),
      id: v.cve || `${v.package}_unknown`,
      severity: v.severity || "UNKNOWN"
    }));

    /* =========================
       🔥 ROOT PACKAGE (CRITICAL FIX)
    ========================= */
    const ROOT = depEdges[0]?.from || "root";

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
       ✅ REPO → ROOT (🔥 IMPORTANT)
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
       ✅ PACKAGES
    ========================= */
    await session.run(
      `
      UNWIND $deps AS dep
      MERGE (p:Package {name: dep.name})
      ON CREATE SET 
        p.version = dep.version,
        p.createdAt = timestamp()
      `,
      { deps: cleanDeps }
    );

    /* =========================
       🔥 DEPENDENCY CHAIN
    ========================= */
    if (cleanEdges.length > 0) {
      await session.run(
        `
        UNWIND $edges AS edge
        MERGE (a:Package {name: edge.from})
        MERGE (b:Package {name: edge.to})
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
        ON CREATE SET 
          vul.createdAt = timestamp()
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