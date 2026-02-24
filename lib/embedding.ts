import { genAI } from "./gemini";

export async function embed(text: string) {
  // Use 'gemini-embedding-001' which is the current unified stable standard
  // as of Feb 2026. This replaces the retired text-embedding-004 and embedding-001.
  const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

  try {
    const result = await model.embedContent(text);
    const embedding = result.embedding;

    if (!embedding || !embedding.values) {
      throw new Error("Invalid embedding response structure");
    }

    return embedding.values;
  } catch (error: any) {
    // This logs the specific failure if gemini-embedding-001 is unavailable in your project/region
    console.error("Embedding Error Details:", error.message);
    throw error;
  }
}