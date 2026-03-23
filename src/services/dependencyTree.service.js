import axios from "axios";

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
   📥 FETCH FILE FROM GITHUB
========================= */

const fetchFile = async (owner, repo, filePath, token) => {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const res = await axios.get(url, {
      headers: getHeaders(token)
    });

    const content = Buffer.from(res.data.content, "base64").toString("utf-8");

    return JSON.parse(content);

  } catch {
    return null;
  }
};

/* =========================
   🌳 BUILD TREE FROM LOCKFILE (🔥 EXPORT FIX)
========================= */

export const buildTreeFromLockfile = (lockfile) => {
  const tree = [];
  const visited = new Set();

  const traverse = (deps, parent = null) => {
    if (!deps) return;

    for (const [name, data] of Object.entries(deps)) {
      const version = data.version || "unknown";
      const key = `${name}@${version}`;

      if (visited.has(key)) continue;
      visited.add(key);

      tree.push({
        name,
        version,
        parent
      });

      if (data.dependencies) {
        traverse(data.dependencies, name);
      }
    }
  };

  traverse(lockfile.dependencies);

  return tree;
};

/* =========================
   🌐 FALLBACK (NO LOCKFILE)
========================= */

export const buildFallbackTree = (pkg) => {
  const deps = pkg?.dependencies || {};

  return Object.entries(deps).map(([name, version]) => ({
    name,
    version: version || "latest",
    parent: null
  }));
};

/* =========================
   🚀 MAIN FUNCTION
========================= */

export const getDependencyTree = async (repoUrl, token = null) => {
  try {
    console.log("⚡ FAST TREE START");

    const { owner, repo } = parseRepo(repoUrl);

    if (!owner || !repo) {
      console.log("❌ Invalid repo");
      return null;
    }

    /* =========================
       📥 FETCH FILES (PARALLEL)
    ========================= */
    const [lockfile, pkg] = await Promise.all([
      fetchFile(owner, repo, "package-lock.json", token),
      fetchFile(owner, repo, "package.json", token)
    ]);

    if (!pkg) {
      console.log("⚠️ No package.json");
      return [];
    }

    /* =========================
       🌳 TREE LOGIC
    ========================= */
    let tree = [];

    if (lockfile?.dependencies) {
      console.log("✅ LOCKFILE MODE (accurate + fast)");
      tree = buildTreeFromLockfile(lockfile);
    } else {
      console.log("⚠️ FALLBACK MODE");
      tree = buildFallbackTree(pkg);
    }

    console.log(`🌳 Tree size: ${tree.length}`);

    return tree;

  } catch (err) {
    console.log("❌ Tree error:", err.message);
    return [];
  }
};
