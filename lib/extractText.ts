// @/lib/extractText.ts
import pdf from "pdf-parse-fork";
import mammoth from "mammoth";

export async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  // --- PDF ---
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    // pdf-parse-fork is much more Node-friendly
    const data = await pdf(buffer);
    return data.text;
  }

  // --- DOCX ---
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("Unsupported file type");
}