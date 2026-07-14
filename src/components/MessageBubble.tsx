import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { type UIMessage } from "ai";

export function MessageBubble({ message }: { message: UIMessage }) {
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const isUser = message.role === "user";
  return (
    <div className={"flex " + (isUser ? "justify-end" : "justify-start")}>
      <div
        className={
          "max-w-[85%] rounded-lg px-3 py-2 text-sm " +
          (isUser ? "bg-primary text-primary-foreground" : "bg-background border border-border")
        }
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1">
            <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{text || "…"}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
