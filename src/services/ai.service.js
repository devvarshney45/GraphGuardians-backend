import axios from "axios";

export const generateAIInsights = async (vulnerabilities) => {
  try {
    if (!vulnerabilities.length) return [];

    // 🔥 Combine all vulnerabilities in one prompt
    const prompt = `
You are a cybersecurity expert.

Analyze the following vulnerabilities and return structured JSON.

For each vulnerability, provide:
- package
- explanation (simple)
- risk (why dangerous)
- fix (npm/yarn command)
- bestPractice

Vulnerabilities:
${vulnerabilities.map(v => `
Package: ${v.package}
Severity: ${v.severity}
Description: ${v.description}
`).join("\n")}

Return ONLY JSON array.
`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    let aiText = response.data.choices[0].message.content;

    // 🔥 try parsing JSON safely
    let parsed;

    try {
      parsed = JSON.parse(aiText);
    } catch {
      // fallback if model returns text
      parsed = vulnerabilities.map(v => ({
        package: v.package,
        explanation: v.description,
        risk: "Potential security risk",
        fix: "Update to latest version",
        bestPractice: "Regularly update dependencies"
      }));
    }

    return parsed;

  } catch (err) {
    console.log("AI error:", err.message);

    // 🔥 fallback (VERY IMPORTANT)
    return vulnerabilities.map(v => ({
      package: v.package,
      explanation: v.description,
      risk: "Potential security issue",
      fix: "Update package to latest version",
      bestPractice: "Keep dependencies updated"
    }));
  }
};
