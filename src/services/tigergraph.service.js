import axios from "axios";
import { ENV } from "../config/env.js";  
const HOST  = process.env.TIGERGRAPH_HOST  || "https://tg-e28748c1-969d-4986-bf35-aa5dbccae874.tg-2635877100.i.tgcloud.io";
const GRAPH = process.env.TIGERGRAPH_GRAPH || "dev";
const TOKEN = process.env.TIGERGRAPH_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJkZXYyNDE1NDA0NEBha2dlYy5hYy5pbiIsImlhdCI6MTc3NTMzMTIzMSwiZXhwIjoxNzgzMTA3MjM2LCJpc3MiOiJUaWdlckdyYXBoIn0.WdAB9GcgsLGZ9zSsFutGtBClkvJRXJSRZUOCV_RJjRs";

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

const BATCH  = 8;
const DELAY  = 400;
const wait   = (ms) => new Promise(r => setTimeout(r, ms));

/* ── single query call ── */
const tgGet = async (query, params) => {
  const qs = new URLSearchParams(params).toString();
  const url = `${HOST}/restpp/query/${GRAPH}/${query}?${qs}`;
  const res = await axios.get(url, { headers, timeout: 8000 });
  return res.data;
};

/* ══════════════════════════════
   PUSH DEPS + VULNS TO TIGERGRAPH
══════════════════════════════ */
export const pushToTigerGraph = async (repoId, deps = [], vulns = [], depEdges = []) => {
  console.log("🧠 TigerGraph Sync Start");

  /* 1. Push dependencies */
  for (let i = 0; i < deps.length; i += BATCH) {
    const batch = deps.slice(i, i + BATCH);
    await Promise.all(batch.map(dep =>
      tgGet("insertDynamicData", {
        repoId,
        depName:    dep.name    || "",
        depVersion: dep.version || "unknown",
        vulnId:     "",
        severity:   "",
      }).catch(e => console.log("❌ dep push:", e.response?.data?.message || e.message))
    ));
    await wait(DELAY);
  }

  /* 2. Push vulnerabilities */
  for (let i = 0; i < vulns.length; i += BATCH) {
    const batch = vulns.slice(i, i + BATCH);
    await Promise.all(batch.map(v =>
      tgGet("insertDynamicData", {
        repoId,
        depName:    v.package  || "",
        depVersion: "unknown",
        vulnId:     v.id       || "",
        severity:   v.severity || "LOW",
      }).catch(e => console.log("❌ vuln push:", e.response?.data?.message || e.message))
    ));
    await wait(DELAY);
  }

  /* 3. Push dep→dep chain edges */
  if (depEdges.length > 0) {
    console.log("🔗 Pushing dependency chains...");
    for (let i = 0; i < depEdges.length; i += BATCH) {
      const batch = depEdges.slice(i, i + BATCH);
      await Promise.all(batch.map(e =>
        tgGet("insertDependencyChain", {
          from_dep: e.from || "",
          to_dep:   e.to   || "",
        }).catch(err => console.log("❌ chain push:", err.response?.data?.message || err.message))
      ));
      await wait(DELAY);
    }
  }

  console.log("🎉 TigerGraph Sync Complete");
};

/* ══════════════════════════════
   GET CHAIN GRAPH
══════════════════════════════ */
export const getChainFromTigerGraph = async (repoId) => {
  const url = `${HOST}/restpp/query/${GRAPH}/getDependencyChain?repoId=${encodeURIComponent(repoId)}`;
  console.log("🔗 Fetching TG chain:", url);
  try {
    const res = await axios.get(url, { headers, timeout: 10000 });
    const raw = res.data?.results?.[0]?.edges || [];
    console.log("📦 TG raw response:", JSON.stringify({ edges: raw.slice(0,3) }));
    return raw
      .map(e => ({ from: e.from_id || e.from, to: e.to_id || e.to }))
      .filter(e => e.from && e.to);
  } catch (e) {
    console.log("❌ TG chain fetch:", e.response?.data?.message || e.message);
    return [];
  }
};
