import axios from "axios";

export const fetchPackageJson = async (repoUrl) => {
  try {
    // extract owner/repo
    const parts = repoUrl.split("github.com/")[1].split("/");
    const owner = parts[0];
    const repo = parts[1];

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/package.json`;

    const res = await axios.get(url);

    const content = Buffer.from(res.data.content, "base64").toString("utf-8");

    return JSON.parse(content);
  } catch (err) {
    throw new Error("Failed to fetch package.json");
  }
};