import axios from "axios";
import { Buffer } from "buffer"; // 🔥 FIX 1

/* =========================
🔧 HELPERS
========================= */
const parseRepo = (url) => {
  try {
    const parts = url.split("github.com/")[1]?.split("/");

    if (!parts || parts.length < 2) {
      throw new Error("Invalid GitHub URL");
    }

    return {
      owner: parts[0],
      repo: parts[1].replace(".git", "")
    };
  } catch {
    return {};
  }
};

const getHeaders = (token) => ({
  Accept: "application/vnd.github+json",
  ...(token && { Authorization: `token ${token}` })
});

/* =========================
📥 FETCH FILE
========================= */
const fetchFile = async (owner, repo, filePath, token) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const res = await axios.get(url, {
      headers: getHeaders(token)
    });

    // 🔥 FIX 2: safe content check
    if (!res.data?.content) {
      console.log(`⚠️ No content in ${filePath}`);
      return null;
    }

    const content = Buffer.from(res.data.content, "base64").toString("utf-8");

    return JSON.parse(content);

  } catch (err) {
    console.log(`⚠️ Failed to fetch ${filePath}:`, err.message);
    return null;
  }
};

/* =========================
🌳 TREE BUILDER
========================= */
export const buildTreeFromLockfile = (lockfile) => {
  const tree = [];
  const visited = new Set();

  const traverse = (deps, parent = null, path = []) => {
    if (!deps) return;

    for (const [name, data] of Object.entries(deps)) {
      const version = data.version || "unknown";

      const currentPath = [...path, name];

      const key = `${name.toLowerCase()}@${version}_${parent || "root"}`;

      if (visited.has(key)) continue;
      visited.add(key);

      tree.push({
        name: name.toLowerCase(),
        version,
        parent: parent ? parent.toLowerCase() : null,
        path: currentPath.join("->"),
        depth: currentPath.length
      });

      const childDeps = data.dependencies || data.requires;

      if (childDeps && typeof childDeps === "object") {
        traverse(childDeps, name, currentPath);
      }
    }
  };

  if (lockfile?.dependencies) {
    traverse(lockfile.dependencies);
  }

  return tree;
};

/* =========================
🌐 FALLBACK
========================= */
export const buildFallbackTree = (pkg) => {
  const deps = {
    ...(pkg?.dependencies || {}),
    ...(pkg?.devDependencies || {}),
    ...(pkg?.peerDependencies || {})
  };

  return Object.entries(deps).map(([name, version]) => ({
    name: name.toLowerCase(),
    version: version || "latest",
    parent: null,
    path: name,
    depth: 1
  }));
};

/* =========================
🚀 MAIN
========================= */
export const getDependencyTree = async (repoUrl, token = null) => {
  try {
    console.log("⚡ TREE BUILD START");

    const { owner, repo } = parseRepo(repoUrl);

    if (!owner || !repo) {
      console.log("❌ Invalid repo");
      return [];
    }

    const [lockfile, pkg] = await Promise.all([
      fetchFile(owner, repo, "package-lock.json", token),
      fetchFile(owner, repo, "package.json", token)
    ]);

    if (!pkg) {
      console.log("⚠️ No package.json found");
      return [];
    }

    let tree = [];

    if (lockfile?.dependencies) {
      console.log("✅ LOCKFILE MODE");

      tree = buildTreeFromLockfile(lockfile);

      if (!tree.length) {
        console.log("⚠️ Empty lockfile → fallback");
        tree = buildFallbackTree(pkg);
      }

    } else {
      console.log("⚠️ FALLBACK MODE");
      tree = buildFallbackTree(pkg);
    }

    console.log(`🌳 Final Tree Size: ${tree.length}`);

    return tree;

  } catch (err) {
    console.log("❌ Tree error:", err.message);
    return [];
  }
};
