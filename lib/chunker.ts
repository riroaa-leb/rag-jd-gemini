export function chunkText(text: string) {
  const size = 1000;
  const overlap = 200;
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += size - overlap) {
    chunks.push(text.slice(i, i + size));
  }

  return chunks;
}