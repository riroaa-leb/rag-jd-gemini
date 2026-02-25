// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/db";
import { chunkText } from "@/lib/chunker";
import { embed } from "@/lib/embedding";
import { genAI } from "@/lib/gemini";
import pdf from "pdf-parse";

// --- Extract text from PDF or fallback to text file ---
async function extractText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (file.type === "application/pdf") {
    const data = await pdf(buffer);
    return data.text;
  }

  // For plain text files
  return new TextDecoder().decode(arrayBuffer);
}

// --- Extract role + seniority using Gemini 2.5 Flash ---
async function getJobMetadata(text: string) {
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

  for (let i = 0; i < 5; i++) {
    try {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      if (responseText) {
        try {
          return JSON.parse(responseText);
        } catch {
          console.warn("Failed to parse JSON:", responseText);
          return { role: "Unknown", seniority: "Unknown" };
        }
      }
    } catch (err: any) {
      const delay = Math.pow(2, i) * 1000;
      console.warn(`Attempt ${i + 1} failed: ${err.message}. Retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.error("Failed to extract metadata after 5 attempts.");
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

    // 3️⃣ Insert JD into Supabase
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