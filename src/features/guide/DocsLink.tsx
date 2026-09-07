import { ArrowUpRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

export function DocsLink({ disabled = false }: { disabled?: boolean }) {
  return (
    <Link
      id="workspace-docs-link"
      className="docs-link"
      to="/docs/getting-started"
      aria-disabled={disabled || undefined}
      onClick={(event) => {
        if (disabled) event.preventDefault();
      }}
    >
      <BookOpen size={18} aria-hidden="true" />
      Docs & guides
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  );
}
