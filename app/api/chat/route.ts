import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { embed } from "@/lib/embedding";
import { genAI } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { question, jdId } = await req.json();

    if (!question || !jdId) {
      return NextResponse.json(
        { error: "Missing question or jdId" },
        { status: 400 }
      );
    }

    // 1️⃣ Embed the question
    const queryEmbedding = await embed(question);

    // 2️⃣ Fetch relevant chunks from Supabase
    const { data, error } = await supabase.rpc("match_chunks", {
      query_embedding: queryEmbedding,
      jd: jdId,
      match_count: 5
    });

    if (error) {
      console.error("Supabase RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ answer: "No context found in JD." });
    }

    const context = data.map((d: any) => d.content).join("\n");

    // 3️⃣ Ask Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
Answer ONLY using the job description, also generate a daily task list.
If not mentioned, say: Not specified in JD.

Context:
${context}

Question:
${question}
`;

    const result = await model.generateContent(prompt);

    // ✅ Ensure JSON is valid
    return NextResponse.json({ answer: result.response.text() });
  } catch (err: any) {
    console.error("Chat route error:", err);
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}