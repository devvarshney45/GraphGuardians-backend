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
// ✅ Single call mein top 5 vulns ka analysis
export const generateAIInsights = async (vulns) => {
  // Sirf top 5 critical/high lo
  const priority = vulns
    .filter(v => ["CRITICAL", "HIGH"].includes(v.severity))
    .slice(0, 5);

  if (priority.length === 0) return fallbackInsights(vulns);

  // ✅ EK hi call mein sab
  const prompt = `
You are a security expert. Analyze these ${priority.length} vulnerabilities 
and give ONE combined JSON response.

Vulnerabilities:
${priority.map((v, i) => `${i+1}. Package: ${v.package}, ID: ${v.id}, Severity: ${v.severity}`).join("\n")}

Respond ONLY with this JSON (no markdown):
{
  "summary": "2-3 line overall risk assessment",
  "riskLevel": "CRITICAL|HIGH|MEDIUM|LOW",
  "issues": [
    {
      "package": "name",
      "explanation": "why dangerous",
      "risk": "severity",
      "fix": "npm install package@version",
      "bestPractice": "one line tip"
    }
  ],
  "topAction": "single most important fix right now"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",        // ✅ gpt-4 nahi — cheaper + faster
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }]
    });

    const raw = response.choices[0].message.content;
    return JSON.parse(raw.replace(/```json|```/g, "").trim());

  } catch (err) {
    console.log("❌ AI failed:", err.message);
    return fallbackInsights(vulns);
  }
};

// ✅ Fallback — AI nahi aya toh bhi kuch show karo
const fallbackInsights = (vulns) => {
  const critical = vulns.filter(v => v.severity === "CRITICAL");
  const high = vulns.filter(v => v.severity === "HIGH");
  return {
    summary: `Found ${vulns.length} vulnerabilities. ${critical.length} critical, ${high.length} high priority.`,
    riskLevel: critical.length > 0 ? "CRITICAL" : high.length > 0 ? "HIGH" : "MEDIUM",
    topAction: critical[0] ? `Fix ${critical[0].package} immediately` : "Run npm audit fix",
    issues: vulns.slice(0, 5).map(v => ({
      package: v.package,
      explanation: "Security vulnerability detected",
      risk: v.severity,
      fix: `npm install ${v.package}@latest`,
      bestPractice: "Keep dependencies updated"
    }))
  };
};
