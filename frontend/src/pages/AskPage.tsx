import React, { useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { Send, AlertCircle } from "lucide-react";

export const AskPage: React.FC = () => {
  const [prompt, setPrompt] = useState("");

  const sampleQueries = [
    "Where is the highest service gap for a diagnostic clinic in Pune?",
    "Show me areas with high student population and low competition for cafes.",
    "Which zones have good transit accessibility but few pharmacies?",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
          Ask UrbanIQ (Natural Language Interface)
        </h1>
        <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#64748b" }}>
          Query location intelligence using plain English. Grounded strictly in UrbanIQ GIS scores.
        </p>
      </div>

      <div style={{ display: "flex", gap: "12px", padding: "14px 18px", backgroundColor: "#eff6ff", borderRadius: "10px", border: "1px solid #bfdbfe", alignItems: "center" }}>
        <AlertCircle size={18} color="#2563eb" style={{ flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: "13px", color: "#1e40af", lineHeight: 1.5 }}>
          <strong>Grounding Rule:</strong> The LLM translates queries into structured spatial
          filters and explains backend results. It will <em>never</em> hallucinate or invent
          geographic scores.
        </p>
      </div>

      <Card title="Ask a Location Question">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Where should I open a pediatric clinic in Pune?"
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                outline: "none",
              }}
            />
            <Button variant="primary" size="md" rightIcon={<Send size={15} />}>
              Analyze
            </Button>
          </div>

          <div>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
              EXAMPLE QUERIES:
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              {sampleQueries.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(q)}
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #f1f5f9",
                    backgroundColor: "#f8fafc",
                    fontSize: "13px",
                    color: "#334155",
                    cursor: "pointer",
                  }}
                >
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AskPage;
