"use client"; // must be first line

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import ChatUI from "@/components/ChatUI";

export default function Page() {
  const [jdId, setJdId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <h1 className="text-3xl font-bold mb-6">JD RAG System</h1>
      <div className="w-full max-w-xl bg-white p-6 rounded-lg shadow-md mb-6">
        <UploadForm onUploaded={setJdId} />
      </div>
      {jdId && (
        <div className="w-full max-w-xl bg-white p-6 rounded-lg shadow-md">
          <ChatUI jdId={jdId} />
        </div>
      )}
    </div>
  );
}
