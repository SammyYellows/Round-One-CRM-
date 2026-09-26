export default function Topbar({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <h1>{title}</h1>
      <div className="row">{children}</div>
    </header>
  );
}
