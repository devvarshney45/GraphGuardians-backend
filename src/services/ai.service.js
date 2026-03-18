import axios from "axios";

// 🔥 AI-based explanation + fix generator
export const generateAIInsights = async (vulnerabilities) => {
  try {
    const results = [];

    for (const v of vulnerabilities) {

      // 🧠 prompt
      const prompt = `
You are a cybersecurity expert.

Explain this vulnerability in simple developer-friendly language:
Package: ${v.package}
Severity: ${v.severity}
Description: ${v.description}

Also provide:
1. Why it is dangerous
2. How to fix it (npm/yarn command)
3. Best practice to avoid it
`;

      // 🔥 Replace with OpenAI / any AI API
      const response = await axios.post("https://api.openai.com/v1/chat/completions", {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      }, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });

      const aiText = response.data.choices[0].message.content;

      results.push({
        package: v.package,
        insight: aiText
      });
    }

    return results;

  } catch (err) {
    console.log("AI error:", err.message);
    return [];
  }
};
