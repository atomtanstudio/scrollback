"use client";

import { useState } from "react";

interface JsonCodeBlockProps {
  code: string;
  onCopy?: () => void;
}

type TokenType =
  | "key"
  | "string"
  | "number"
  | "boolean"
  | "null"
  | "punctuation"
  | "whitespace";

interface Token {
  type: TokenType;
  value: string;
}

const tokenColors: Record<TokenType, string | undefined> = {
  key: "#8fb1b8",
  string: "#d6bd9d",
  number: "#c99272",
  boolean: "#c49aa2",
  null: "#c49aa2",
  punctuation: "#6f675e",
  whitespace: undefined,
};

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (/\s/.test(char)) {
      let ws = "";
      while (i < line.length && /\s/.test(line[i])) {
        ws += line[i++];
      }
      tokens.push({ type: "whitespace", value: ws });
      continue;
    }

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
      i++;

      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;

      if (line[j] === ":") {
        tokens.push({ type: "key", value: str });
      } else {
        tokens.push({ type: "string", value: str });
      }
      continue;
    }

    if (/[-\d]/.test(char) && (char !== "-" || /\d/.test(line[i + 1] || ""))) {
      let num = "";
      while (i < line.length && /[-\d.eE+]/.test(line[i])) {
        num += line[i++];
      }
      tokens.push({ type: "number", value: num });
      continue;
    }

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

    if (line.startsWith("null", i)) {
      tokens.push({ type: "null", value: "null" });
      i += 4;
      continue;
    }

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
    <div className="relative overflow-x-auto rounded-[22px] border border-[#d6c9b214] bg-[#0f141a] p-5">
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 rounded-full border border-[#d6c9b21f] bg-[#171d24] px-3 py-1 text-[11px] text-[#9c9387] transition-colors hover:text-[#f2ede5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b89462]"
      >
        {copied ? "Copied!" : "Copy"}
      </button>

      <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[13px] leading-[1.7]">
        {lines.map((line, lineIndex) => {
          const tokens = tokenizeLine(line);
          return (
            <div key={lineIndex} className="flex">
              <span
                className="mr-4 inline-block w-[28px] shrink-0 select-none text-right"
                style={{ color: "#6f675e" }}
              >
                {lineIndex + 1}
              </span>
              <span>
                {tokens.map((token, tokenIndex) => {
                  const color = tokenColors[token.type];
                  if (!color) {
                    return <span key={tokenIndex}>{token.value}</span>;
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
