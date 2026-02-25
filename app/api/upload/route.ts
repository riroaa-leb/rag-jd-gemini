// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/db";
import { extractText } from "@/lib/extractText";
import { chunkText } from "@/lib/chunker";
import { embed } from "@/lib/embedding";
import { genAI } from "@/lib/gemini";

// --- Extract role + seniority using Gemini 2.5 Flash ---
async function getJobMetadata(text: string) {
  console.log("--- Starting Metadata Extraction ---");
  console.log("Input text length (sliced):", text.slice(0, 3000).length);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `
Extract job metadata from the following job description.
Return JSON ONLY with keys "role" and "seniority".

Job Description:
${text.slice(0, 3000)}
`;

  for (let i = 0; i < 2; i++) {
    const startTime = Date.now();
    try {
      console.log(`Gemini Attempt ${i + 1} sending...`);
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const duration = Date.now() - startTime;
      let cleanJson = "";

      console.log(`Gemini Attempt ${i + 1} received in ${duration}ms`);
      console.log("Raw Response Content:", responseText);

      if (responseText) {
        try {
          cleanJson = responseText.replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(cleanJson);
          console.log("Successfully parsed metadata:", parsed);
          return parsed;
        } catch (parseError) {
          console.error("JSON Parse Error. Cleaned text was:", cleanJson);
          return { role: "Parse Error", seniority: "Parse Error" };
        }
      } else {
        console.warn("Gemini returned an empty response text.");
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error(`Gemini Attempt ${i + 1} FAILED after ${duration}ms:`, err.message);
      
      // Check for common Vercel/API issues
      if (err.message.includes("403")) console.error("Check if your API Key is valid and has Gemini access.");
      if (err.message.includes("429")) console.error("Rate limit hit.");

      const delay = 1000 * (i + 1); 
      if (i < 1) {
        console.log(`Waiting ${delay}ms before next retry...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  console.error("All Gemini attempts exhausted. Returning Unknown.");
  return { role: "Unknown", seniority: "Unknown" };
}

// --- Upload Route ---
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 1️⃣ Extract text
    const text = await extractText(file);
    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "Failed to extract text from file" }, { status: 400 });
    }

    console.log("Extracted text length:", text.length);
    console.log("File name:", file.name, "Type:", file.type);

    // 2️⃣ Extract metadata
    const metadata = await getJobMetadata(text);

    // 3️⃣ Insert JD into Supabase and capture errors
    const jdId = uuidv4();
    const { error: jdError } = await supabase.from("job_descriptions").insert({
      id: jdId,
      role: metadata.role,
      seniority: metadata.seniority,
      file_name: file.name,
    });
    if (jdError) {
      console.error("Failed to insert JD:", jdError);
      return NextResponse.json({ error: jdError.message }, { status: 500 });
    }

    // 4️⃣ Chunk the text
    const chunks = chunkText(text);
    console.log("Number of chunks:", chunks.length);

    // 5️⃣ Embed and insert each chunk
    for (const chunk of chunks) {
      try {
        const embedding = await embed(chunk);

        // Validate embedding
        if (!Array.isArray(embedding) || embedding.length !== 3072) {
          console.warn("Invalid embedding, skipping chunk:", embedding?.length);
          continue;
        }

        const { error: chunkError } = await supabase.from("document_chunks").insert({
          id: uuidv4(),
          jd_id: jdId,
          content: chunk,
          embedding,
        });

        if (chunkError) console.error("Chunk insert error:", chunkError);
        else console.log("Chunk inserted successfully");

      } catch (err) {
        console.error("Embedding or insert failed for chunk:", err);
      }
    }

    return NextResponse.json({ jdId, role: metadata.role, seniority: metadata.seniority });

  } catch (err: any) {
    console.error("Upload route error:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}