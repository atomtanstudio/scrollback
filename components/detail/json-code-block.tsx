"use client";

import { useState } from "react";

interface JsonCodeBlockProps {
  code: string;
  onCopy?: () => void;
}

type TokenType = "key" | "string" | "number" | "boolean" | "null" | "punctuation" | "whitespace";

interface Token {
  type: TokenType;
  value: string;
}

const tokenColors: Record<TokenType, string | undefined> = {
  key: "#22d3ee",
  string: "#a78bfa",
  number: "#fb923c",
  boolean: "#ec4899",
  null: "#ec4899",
  punctuation: "#555566",
  whitespace: undefined,
};

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    // Whitespace
    if (/\s/.test(char)) {
      let ws = "";
      while (i < line.length && /\s/.test(line[i])) {
        ws += line[i++];
      }
      tokens.push({ type: "whitespace", value: ws });
      continue;
    }

    // String (key or value)
    if (char === '"') {
      let str = '"';
      i++;
      while (i < line.length && line[i] !== '"') {
        if (line[i] === "\\") {
          str += line[i++];
        }
        if (i < line.length) {
          str += line[i++];
        }
      }
      str += '"';
      i++; // closing quote

      // Look ahead past whitespace to check for ':'
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;

      if (line[j] === ":") {
        tokens.push({ type: "key", value: str });
      } else {
        tokens.push({ type: "string", value: str });
      }
      continue;
    }

    // Number (including negative and floats)
    if (/[-\d]/.test(char) && (char !== "-" || /\d/.test(line[i + 1] || ""))) {
      let num = "";
      while (i < line.length && /[-\d.eE+]/.test(line[i])) {
        num += line[i++];
      }
      tokens.push({ type: "number", value: num });
      continue;
    }

    // Boolean true/false
    if (line.startsWith("true", i)) {
      tokens.push({ type: "boolean", value: "true" });
      i += 4;
      continue;
    }
    if (line.startsWith("false", i)) {
      tokens.push({ type: "boolean", value: "false" });
      i += 5;
      continue;
    }

    // null
    if (line.startsWith("null", i)) {
      tokens.push({ type: "null", value: "null" });
      i += 4;
      continue;
    }

    // Punctuation
    tokens.push({ type: "punctuation", value: char });
    i++;
  }

  return tokens;
}

export function JsonCodeBlock({ code, onCopy }: JsonCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const lines = code.split("\n");

  return (
    <div className="bg-[#0c0c14] border border-[rgba(255,255,255,0.06)] rounded-xl p-5 overflow-x-auto relative">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] rounded-md px-2.5 py-1 text-[11px] text-[#8888aa] hover:text-[#f0f0f5] hover:bg-[rgba(255,255,255,0.1)] transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>

      <pre className="font-mono text-[13px] leading-[1.65] m-0 whitespace-pre-wrap break-words">
        {lines.map((line, lineIndex) => {
          const tokens = tokenizeLine(line);
          return (
            <div key={lineIndex} className="flex">
              <span
                className="select-none text-right mr-4 flex-shrink-0"
                style={{
                  color: "#555566",
                  width: "28px",
                  display: "inline-block",
                }}
              >
                {lineIndex + 1}
              </span>
              <span>
                {tokens.map((token, tokenIndex) => {
                  const color = tokenColors[token.type];
                  if (!color) {
                    return (
                      <span key={tokenIndex}>{token.value}</span>
                    );
                  }
                  return (
                    <span key={tokenIndex} style={{ color }}>
                      {token.value}
                    </span>
                  );
                })}
              </span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
