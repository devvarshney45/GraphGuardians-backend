import axios from "axios";

export const askAI = async (req, res) => {
  try {
    const { question, repoData } = req.body;

    const prompt = `
You are a cybersecurity expert.

Repo Data:
${JSON.stringify(repoData)}

Question:
${question}
`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    res.json({
      answer: response.data.choices[0].message.content
    });

  } catch {
    res.json({ answer: "AI unavailable" });
  }
};
