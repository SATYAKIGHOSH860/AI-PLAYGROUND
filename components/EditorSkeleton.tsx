const WIDTHS = ['42%', '68%', '55%', '30%', '74%', '48%', '61%', '36%'];

/** Shown while Monaco downloads, so the pane never flashes empty. */
export default function EditorSkeleton() {
  return (
    <div className="editor-skeleton" aria-hidden>
      {WIDTHS.map((width, index) => (
        <span key={index} style={{ width }} />
      ))}
    </div>
  );
}
