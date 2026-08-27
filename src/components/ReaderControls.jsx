import { Link } from "react-router-dom";
import { NotebookPen } from "lucide-react";

export default function ReaderControls({ fontSize, setFontSize }) {
  return (
    <div className="reader-controls">
      <button onClick={() => setFontSize(Math.max(16, fontSize - 2))}>A-</button>
      <span>{fontSize}px</span>
      <button onClick={() => setFontSize(Math.min(28, fontSize + 2))}>A+</button>
      <Link to="/read/journal" className="button secondary" title="Open notes">
        <NotebookPen size={16} />
        Notes
      </Link>
    </div>
  );
}
