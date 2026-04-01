import axios from "axios";

export const fetchFileFromGitHub = async (url, filePath, token) => {
  try {
    const parts = url.split("github.com/")[1]?.split("/");

    if (!parts || parts.length < 2) {
      console.log("❌ Invalid GitHub URL");
      return null;
    }

    const owner = parts[0];
    const repo = parts[1].replace(".git", "");

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    const res = await axios.get(apiUrl, {
      headers: {
        ...(token && { Authorization: `token ${token}` }), // ✅ safe token
        Accept: "application/vnd.github+json",
      },
    });

    const content = Buffer.from(res.data.content, "base64").toString("utf-8");

    return JSON.parse(content);

  } catch (err) {
    console.log(`❌ Failed to fetch ${filePath}`);
    return null;
  }
};
