import axios from "axios";

/* =========================
   🧠 CACHE (IMPROVED)
========================= */
const aiCache = new Map();

/* =========================
   🔁 RETRY FUNCTION
========================= */
const callAI = async (payload, retries = 2) => {
  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    return res.data;

  } catch (err) {
    if (err.response?.status === 429 && retries > 0) {
      console.log("⚠️ Rate limit... retrying");

      await new Promise(r => setTimeout(r, 1500));

      return callAI(payload, retries - 1);
    }

    throw err;
  }
};

/* =========================
   🤖 MAIN FUNCTION
========================= */
export const generateAIInsights = async (vulnerabilities = []) => {
  try {
    if (!vulnerabilities.length) {
      return {
        summary: "No vulnerabilities found",
        issues: []
      };
    }

    /* =========================
       🔥 CACHE KEY (STABLE)
    ========================= */
    const cacheKey = JSON.stringify(
      vulnerabilities
        .map(v => `${v.package}-${v.severity}`)
        .sort() // 🔥 IMPORTANT FIX
    );

    if (aiCache.has(cacheKey)) {
      console.log("⚡ AI cache hit");
      return aiCache.get(cacheKey);
    }

    /* =========================
       🔥 LIMIT INPUT
    ========================= */
    const limited = vulnerabilities.slice(0, 10);

    const prompt = `
You are a security expert.

Return STRICT JSON:
{
  "summary": "...",
  "issues": [
    {
      "package": "",
      "explanation": "",
      "risk": "",
      "fix": "",
      "bestPractice": ""
    }
  ]
}

Analyze:

${limited.map(v => `
Package: ${v.package}
Severity: ${v.severity}
`).join("\n")}
`;

    /* =========================
       📡 CALL AI
    ========================= */
    const response = await callAI({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    let aiText = response.choices[0].message.content;

    aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed;

    try {
      parsed = JSON.parse(aiText);
    } catch {
      parsed = {
        summary: "Security risks detected",
        issues: limited.map(v => ({
          package: v.package,
          explanation: "Security issue",
          risk: `${v.severity} vulnerability`,
          fix: `npm update ${v.package}`,
          bestPractice: "Keep dependencies updated"
        }))
      };
    }

    /* =========================
       💾 CACHE SAVE
    ========================= */
    aiCache.set(cacheKey, parsed);

    return parsed;

  } catch (err) {
    console.log("❌ AI failed, fallback used");

    return {
      summary: "AI unavailable",
      issues: vulnerabilities.slice(0, 10).map(v => ({
        package: v.package,
        explanation: "Security issue detected",
        risk: `${v.severity || "unknown"} risk`,
        fix: `npm install ${v.package}@latest`,
        bestPractice: "Run npm audit"
      }))
    };
  }
};
