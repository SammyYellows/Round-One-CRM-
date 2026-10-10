import { Fragment } from "react";

// Plain text with "- " bullets, "### " subheadings and **bold**, built as
// elements (never as HTML). Used by Champ's answers and the manual.
export function Rich({ text }: { text: string }) {
  const bold = (line: string) => line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>));
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let sub: string[] | null = null; // indented bullets under the last one
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length} style={{ margin: "4px 0 10px", paddingLeft: 20 }}>{list.map((l, i) => <li key={i} style={{ marginBottom: 4 }}>{bold(l)}</li>)}</ul>);
    list = []; sub = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (/^\s{2,}[-•*]\s+/.test(line) && list.length) { list[list.length - 1] += ` · ${line.replace(/^\s*[-•*]\s+/, "")}`; continue; }
    if (/^\s*[-•*]\s+/.test(line)) { list.push(line.replace(/^\s*[-•*]\s+/, "")); continue; }
    flush();
    if (/^#{2,3}\s+/.test(line)) blocks.push(<div key={blocks.length} className="label" style={{ margin: "14px 0 6px" }}>{line.replace(/^#+\s+/, "")}</div>);
    else if (line.trim()) blocks.push(<p key={blocks.length} style={{ margin: "0 0 10px" }}>{bold(line)}</p>);
  }
  flush();
  void sub;
  return <>{blocks}</>;
}
