"use client";
import { useState } from "react";

export default function UploadForm({
  onUploaded,
}: {
  onUploaded: (jdId: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setLoading(false);
    onUploaded(data.jdId);
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="border p-2 rounded"
      />
      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Uploading..." : "Upload JD"}
      </button>
    </div>
  );
}
