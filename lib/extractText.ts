import * as pdf from "pdf-parse";
import mammoth from "mammoth";

// Fix for Vercel/Node environment missing DOMMatrix
if (typeof global.DOMMatrix === "undefined") {
  (global as any).DOMMatrix = class {
    constructor() {}
    static fromFloat32Array() { return new this(); }
    static fromFloat64Array() { return new this(); }
  };
}

export async function extractText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  // --- PDF ---
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    const data = await (pdf as any).default(buffer);
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