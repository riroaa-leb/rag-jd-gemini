"use client";
import { useState } from "react";

export default function ChatUI({ jdId }: { jdId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question) return;
    setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, jdId }),
    });

    const data = await res.json();
    setAnswer(data.answer);
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a question about this JD..."
        className="border p-2 rounded resize-none h-24"
      />
      <button
        onClick={handleAsk}
        disabled={!question || loading}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "Thinking..." : "Ask"}
      </button>
      {answer && (
        <div className="bg-gray-100 p-3 rounded border border-gray-200 whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </div>
  );
}
