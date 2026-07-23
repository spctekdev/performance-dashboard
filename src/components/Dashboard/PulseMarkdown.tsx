import type { ReactNode } from "react";
import { BookOpen, ExternalLink } from "lucide-react";

function inlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const pattern =
    /(\[[^\]]+\]\((?:https?:\/\/[^)\s]+|knowledge:[0-9a-fA-F-]{36})\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let index = 0;

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{inlineMarkdown(token.slice(2, -2), `${key}-strong`)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+|knowledge:([0-9a-fA-F-]{36}))\)$/);
      if (link) {
        const knowledgeId = link[3];
        nodes.push(
          knowledgeId ? (
            <a
              className="pulse-knowledge-link"
              key={key}
              href={`/dashboard?tab=knowledge&knowledge=${knowledgeId}`}
              target="_blank"
              rel="noreferrer"
              title="Open this knowledge item in a new tab"
            >
              <BookOpen size={14} aria-hidden="true" />
              <span>{link[1]}</span>
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : (
            <a key={key} href={link[2]} target="_blank" rel="noreferrer">
              {link[1]}
            </a>
          ),
        );
      }
    } else {
      nodes.push(<em key={key}>{inlineMarkdown(token.slice(1, -1), `${key}-em`)}</em>);
    }
    cursor = start + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function startsBlock(line: string) {
  return /^(#{1,3}\s+|```|>\s?|[-*]\s+|\d+\.\s+)/.test(line.trim());
}

export function PulseMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let cursor = 0;

  while (cursor < lines.length) {
    const trimmed = lines[cursor].trim();
    if (!trimmed) {
      cursor++;
      continue;
    }
    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const code: string[] = [];
      cursor++;
      while (cursor < lines.length && !lines[cursor].trim().startsWith("```")) code.push(lines[cursor++]);
      if (cursor < lines.length) cursor++;
      blocks.push(
        <pre key={`code-${cursor}`}>
          <code data-language={language || undefined}>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const children = inlineMarkdown(heading[2], `heading-${cursor}`);
      blocks.push(
        heading[1].length === 1 ? (
          <h3 key={`heading-${cursor}`}>{children}</h3>
        ) : (
          <h4 key={`heading-${cursor}`}>{children}</h4>
        ),
      );
      cursor++;
      continue;
    }
    const listMatch = trimmed.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const items: string[] = [];
      while (cursor < lines.length) {
        const item = lines[cursor].trim().match(ordered ? /^\d+\.\s+(.+)$/ : /^[-*]\s+(.+)$/);
        if (!item) break;
        items.push(item[1]);
        cursor++;
      }
      const children = items.map((item, index) => (
        <li key={index}>{inlineMarkdown(item, `item-${cursor}-${index}`)}</li>
      ));
      blocks.push(ordered ? <ol key={`list-${cursor}`}>{children}</ol> : <ul key={`list-${cursor}`}>{children}</ul>);
      continue;
    }
    if (trimmed.startsWith(">")) {
      const quote: string[] = [];
      while (cursor < lines.length && lines[cursor].trim().startsWith(">"))
        quote.push(lines[cursor++].trim().replace(/^>\s?/, ""));
      blocks.push(
        <blockquote key={`quote-${cursor}`}>{inlineMarkdown(quote.join(" "), `quote-${cursor}`)}</blockquote>,
      );
      continue;
    }
    const paragraph = [trimmed];
    cursor++;
    while (cursor < lines.length && lines[cursor].trim() && !startsBlock(lines[cursor]))
      paragraph.push(lines[cursor++].trim());
    blocks.push(<p key={`paragraph-${cursor}`}>{inlineMarkdown(paragraph.join(" "), `paragraph-${cursor}`)}</p>);
  }

  return <div className="pulse-markdown">{blocks}</div>;
}
