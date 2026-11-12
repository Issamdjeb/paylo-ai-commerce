import React from "react";
import { Link } from "wouter";
import { ExternalLink } from "lucide-react";
import { PayloMascot } from "./PayloMascot";
import { FALLBACK_TOOLS } from "@/data/fallback-tools";
import { slugify } from "@/lib/slugify";

interface FormattedChatMessageProps {
  content: string;
  className?: string;
  onPromptClick?: (prompt: string) => void;
}

/**
 * Tokenizes a line into formatted chunks:
 * 1. Markdown links [text](url)
 * 2. Bare URLs https://...
 * 3. Bold **text**
 * 4. Italic *text* or _text_
 * 5. Inline code `code`
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Regex to match links, bare URLs, bold, italic, and inline code
  const regex = /\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s]+)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.substring(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // [Label](url)
      const label = match[1];
      const url = match[2].trim();

      if (url.startsWith("/")) {
        nodes.push(
          <Link
            key={match.index}
            href={url}
            className="inline-flex items-center gap-0.5 font-bold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors cursor-pointer"
          >
            <span>{label}</span>
          </Link>
        );
      } else {
        nodes.push(
          <a
            key={match.index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            <span>{label}</span>
            <ExternalLink className="h-3 w-3 inline shrink-0 opacity-80" />
          </a>
        );
      }
    } else if (match[3]) {
      // Bare URL
      const url = match[3];
      nodes.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-bold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors break-all"
        >
          <span>{url}</span>
          <ExternalLink className="h-3 w-3 inline shrink-0 opacity-80" />
        </a>
      );
    } else if (match[4]) {
      // **bold**
      const boldText = match[4];
      const matchedTool = FALLBACK_TOOLS.find(
        (t) => t.name.toLowerCase() === boldText.trim().toLowerCase()
      );

      if (matchedTool) {
        nodes.push(
          <Link
            key={match.index}
            href={`/tool/${slugify(matchedTool.name)}`}
            className="font-bold text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            {boldText}
          </Link>
        );
      } else {
        nodes.push(
          <strong key={match.index} className="font-bold text-foreground">
            {boldText}
          </strong>
        );
      }
    } else if (match[5]) {
      // *italic* - strip the stars cleanly, style with medium font
      const italicText = match[5].trim().replace(/^['"]|['"]$/g, "");
      nodes.push(
        <span key={match.index} className="font-medium text-foreground/95">
          {italicText}
        </span>
      );
    } else if (match[6]) {
      // `code`
      nodes.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-muted/80 font-mono text-[11px] text-foreground border border-border"
        >
          {match[6]}
        </code>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex));
  }

  return nodes;
}

export function FormattedChatMessage({ content, className = "", onPromptClick }: FormattedChatMessageProps) {
  if (!content) return null;

  // Pre-clean any accidental raw JSON formatting or bracket command leaks from LLMs
  let cleanContent = content;
  if (typeof cleanContent === "string") {
    // Strip accidental bracket command leaks from open-source models
    cleanContent = cleanContent.replace(/\[STUDIO_NAVIGATE[\s\S]*?(?:\]|$)/gi, "").trim();
    if (!cleanContent) {
      cleanContent = "Here are your verified merchant records and live metrics:";
    }

    const trimmed = cleanContent.trim();
    if (
      trimmed.startsWith("```json") ||
      trimmed.startsWith("```") ||
      trimmed.startsWith('{"reply":') ||
      (trimmed.startsWith("{") && trimmed.includes('"reply"'))
    ) {
      try {
        const unwrap = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(unwrap);
        if (parsed && parsed.reply) {
          cleanContent = parsed.reply;
        }
      } catch {
        const match = trimmed.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (match) {
          try {
            cleanContent = JSON.parse(`"${match[1]}"`);
          } catch {
            cleanContent = match[1];
          }
        }
      }
    }
  }

  const lines = cleanContent.split("\n");
  let inPromptBlock = false;

  return (
    <div className={`space-y-1.5 leading-relaxed text-xs ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          inPromptBlock = false;
          return <div key={idx} className="h-1.5" />;
        }

        const lowerTrimmed = trimmed.toLowerCase();
        if (
          lowerTrimmed.includes("try asking") ||
          lowerTrimmed.includes("ask me") ||
          lowerTrimmed.includes("here is what i can") ||
          lowerTrimmed.includes("quick actions") ||
          lowerTrimmed.includes("suggested questions") ||
          lowerTrimmed.includes("options:") ||
          lowerTrimmed.includes("i can help you") ||
          lowerTrimmed.includes("i can:") ||
          lowerTrimmed.includes("what i can do")
        ) {
          inPromptBlock = true;
        }

        // Section header ### Header
        if (trimmed.startsWith("### ") || trimmed.startsWith("## ")) {
          inPromptBlock = false;
          const headerText = trimmed.replace(/^#{2,3}\s+/, "");
          return (
            <div key={idx} className="font-extrabold text-[13px] text-foreground pt-1 pb-0.5 tracking-tight flex items-center gap-1.5">
              <span>{parseInlineMarkdown(headerText)}</span>
            </div>
          );
        }

        // Bullet point: - item, * item, • item
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
          const rawItem = trimmed.replace(/^[-*•]\s+/, "");

          // Only convert into interactive prompt if it is explicitly marked with 👉 or "Ask:"
          const isExplicitPrompt = Boolean(
            onPromptClick &&
            (rawItem.startsWith("👉") ||
             rawItem.startsWith("▶") ||
             /^(try asking:|ask:|click to ask:)/i.test(rawItem))
          );

          if (isExplicitPrompt && onPromptClick) {
            const cleanQuery = rawItem.replace(/^[👉▶\s]+/, "").replace(/^(try asking:|ask:|click to ask:)\s*/i, "").trim();
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onPromptClick(cleanQuery)}
                className="w-full text-left flex items-start gap-2.5 px-3 py-2 rounded-xl bg-background/80 hover:bg-primary/10 border border-border/80 hover:border-primary/40 text-foreground transition-all cursor-pointer group active:scale-[0.99] my-1.5 shadow-2xs"
              >
                <div className="shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                  <PayloMascot size={16} emotion="idle" interactive={false} showBadge={false} />
                </div>
                <span className="flex-1 font-medium">{parseInlineMarkdown(cleanQuery)}</span>
              </button>
            );
          }

          return (
            <div key={idx} className="flex items-start gap-2 ml-1 my-0.5">
              <span className="text-[#0070ba] dark:text-cyan-400 mt-0.5 select-none shrink-0 text-sm leading-none">•</span>
              <span className="flex-1 whitespace-pre-wrap">{parseInlineMarkdown(rawItem)}</span>
            </div>
          );
        }

        // If a non-bullet line was reached and it wasn't a prompt header, exit prompt block
        if (!lowerTrimmed.includes("try asking") && !lowerTrimmed.includes("ask me") && !lowerTrimmed.includes("help you") && !lowerTrimmed.includes("i can")) {
          inPromptBlock = false;
        }

        // Numbered list: 1. Item
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 ml-1 my-0.5">
              <span className="font-bold text-[#0070ba] dark:text-cyan-400 select-none shrink-0 text-[11px] min-w-[14px]">
                {numMatch[1]}.
              </span>
              <span className="flex-1 whitespace-pre-wrap">{parseInlineMarkdown(numMatch[2])}</span>
            </div>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="whitespace-pre-wrap">
            {parseInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

