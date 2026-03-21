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
       🔥 STRICT CLEAN (ULTRA SAFE)
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
       ROOT
    ========================= */
    const ROOT =
      safeEdges.length > 0
        ? safeEdges[0].from
        : safeDeps[0]?.name || "root";

    /* =========================
       CLEAN OLD GRAPH
    ========================= */
    await session.run(
      `MATCH (r:Repo {id: $repoId})-[*]->(n) DETACH DELETE n`,
      { repoId: String(repoId) }
    );

    /* =========================
       CREATE REPO
    ========================= */
    await session.run(
      `MERGE (r:Repo {id: $repoId})`,
      { repoId: String(repoId) }
    );

    /* =========================
       ROOT NODE
    ========================= */
    await session.run(
      `MERGE (root:Package {name: $root})`,
      { root: ROOT }
    );

    await session.run(
      `
      MATCH (r:Repo {id: $repoId})
      MATCH (root:Package {name: $root})
      MERGE (r)-[:USES]->(root)
      `,
      {
        repoId: String(repoId),
        root: ROOT
      }
    );

    /* =========================
       📦 PACKAGES (SAFE LOOP)
    ========================= */
    for (const dep of safeDeps) {
      if (!dep.name) continue;

      await session.run(
        `
        MERGE (p:Package {name: $name})
        SET p.version = $version
        `,
        {
          name: dep.name,
          version: dep.version
        }
      );
    }

    /* =========================
       🔗 EDGES (SAFE LOOP)
    ========================= */
    for (const edge of safeEdges) {
      if (!edge.from || !edge.to) continue;

      await session.run(
        `
        MATCH (a:Package {name: $from})
        MATCH (b:Package {name: $to})
        MERGE (a)-[:DEPENDS_ON]->(b)
        `,
        {
          from: edge.from,
          to: edge.to
        }
      );
    }

    console.log(`🔗 Dependency edges inserted: ${safeEdges.length}`);

    /* =========================
       🚨 VULNERABILITIES (SAFE LOOP)
    ========================= */
    for (const v of safeVulns) {
      if (!v.package) continue;

      await session.run(
        `
        MATCH (p:Package {name: $package})
        MERGE (vul:Vulnerability {id: $id})
        SET vul.severity = $severity
        MERGE (p)-[:HAS_VULN]->(vul)
        `,
        {
          package: v.package,
          id: v.id,
          severity: v.severity
        }
      );
    }

    console.log(`🚨 Vulnerabilities linked: ${safeVulns.length}`);

    console.log("✅ Neo4j Sync Success");

  } catch (err) {
    console.log("❌ Neo4j Error:", err.message);
  } finally {
    await session.close();
  }
};
