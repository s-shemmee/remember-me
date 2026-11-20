import Link from "next/link";
import type * as React from "react";

import { type Block, type Inline, parseInline } from "./markdown";

const LINK = "font-semibold text-accent-text underline underline-offset-2";

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === "text") return n.text;
        if (n.type === "code") return <code key={i}>{n.text}</code>;
        if (n.type === "strong")
          return (
            <strong key={i}>
              <Inlines nodes={n.children} />
            </strong>
          );
        const children = <Inlines nodes={n.children} />;
        return n.href.startsWith("/") ? (
          <Link key={i} href={n.href} className={LINK}>
            {children}
          </Link>
        ) : (
          <a key={i} href={n.href} className={LINK}>
            {children}
          </a>
        );
      })}
    </>
  );
}

/** A line of text with the inline subset (bold, links, emails as mailto:). */
export function InlineText({ text }: { text: string }) {
  return <Inlines nodes={parseInline(text)} />;
}

/** A help article's body, from the parsed Markdown subset (no HTML strings). */
export function HelpContent({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-3 text-16 leading-relaxed">
      {blocks.map((b, i): React.ReactNode => {
        if (b.type === "heading") {
          const Tag = b.level === 2 ? "h2" : "h3";
          return (
            <Tag
              key={i}
              id={b.id}
              className={
                b.level === 2
                  ? "mt-4 scroll-mt-24 text-22 font-extrabold tracking-[-0.02em]"
                  : "mt-2 scroll-mt-24 text-17 font-bold"
              }
            >
              {b.text}
            </Tag>
          );
        }
        if (b.type === "paragraph")
          return (
            <p key={i}>
              <Inlines nodes={b.children} />
            </p>
          );
        const List = b.ordered ? "ol" : "ul";
        return (
          <List
            key={i}
            className={`flex flex-col gap-2 pl-6 marker:text-sub ${b.ordered ? "list-decimal" : "list-disc"}`}
          >
            {b.items.map((item, j) => (
              <li key={j}>
                <Inlines nodes={item} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
