import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const gemini = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export default async function generateAIResponse(prompt, tools) {
  const { text } = await generateText({
    model: gemini("gemini-2.0-flash-exp"),
    prompt,
    tools,
  });

  return text;
}
