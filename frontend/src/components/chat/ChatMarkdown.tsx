import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

export default function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { trust: false, strict: "ignore", errorColor: "var(--color-danger)" }]]} skipHtml components={{
        a: ({ children, href, title }) => <a href={href} title={title} target="_blank" rel="noopener noreferrer">{children}</a>,
        img: () => null,
        table: ({ children }) => (
          <div className="chat-markdown-table" role="region" aria-label="Bảng trong câu trả lời" tabIndex={0}>
            <table>{children}</table>
          </div>
        ),
      }}>{content}</ReactMarkdown>
  );
}
