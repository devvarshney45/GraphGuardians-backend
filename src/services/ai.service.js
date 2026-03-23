import axios from "axios";

/* =========================
   🧠 SIMPLE CACHE (IN-MEMORY)
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
      console.log("⚠️ Rate limit hit... retrying");

      await new Promise(r => setTimeout(r, 1500)); // 🔥 delay

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
      return [
        {
          package: "none",
          explanation: "No vulnerabilities found",
          risk: "Safe",
          fix: "No action required",
          bestPractice: "Keep dependencies updated"
        }
      ];
    }

    /* =========================
       🔥 CACHE KEY
    ========================= */
    const cacheKey = JSON.stringify(
      vulnerabilities.map(v => `${v.package}-${v.severity}`)
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
Return ONLY JSON.

For each vulnerability:
- package
- explanation
- risk
- fix
- bestPractice

${limited.map(v => `
Package: ${v.package}
Severity: ${v.severity}
`).join("\n")}
`;

    /* =========================
       📡 CALL AI (WITH RETRY)
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
      parsed = limited.map(v => ({
        package: v.package,
        explanation: "Security issue",
        risk: `${v.severity} vulnerability`,
        fix: `npm update ${v.package}`,
        bestPractice: "Update dependencies regularly"
      }));
    }

    /* =========================
       💾 SAVE CACHE
    ========================= */
    aiCache.set(cacheKey, parsed);

    return parsed;

  } catch (err) {
    console.log("❌ AI failed, fallback used");

    return vulnerabilities.slice(0, 10).map(v => ({
      package: v.package,
      explanation: "Security issue detected",
      risk: `${v.severity || "unknown"} risk`,
      fix: `npm install ${v.package}@latest`,
      bestPractice: "Run npm audit"
    }));
  }
};
