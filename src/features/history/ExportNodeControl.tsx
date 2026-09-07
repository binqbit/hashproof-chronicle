import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { ProofNodeDetails } from "./ProofNodeDetails";
import type { ProofGraphNode } from "./proof-graph";
import { useProofSelection } from "./ProofSelectionContext";
import {
  proofSelectionScope,
  type ProofSelectionScope,
} from "./proof-selection";

const scopes: [ProofSelectionScope, string][] = [
  ["record", "This record"],
  ["history", "Previous history"],
  ["continuations", "Continuations"],
  ["connected", "Connected history"],
];

/** Keep selection actions compact; full identifiers remain one click away. */
export function ExportRecordDetails({ node }: { node: ProofGraphNode }) {
  const [details, setDetails] = useState(false);
  return (
    <div
      className="proof-export-details"
      data-view={details ? "details" : "actions"}
    >
      <div className="proof-export-tabs" role="group" aria-label="Record view">
        <button
          type="button"
          aria-pressed={!details}
          onClick={() => setDetails(false)}
        >
          Selection actions
        </button>
        <button
          type="button"
          aria-pressed={details}
          onClick={() => setDetails(true)}
        >
          Full record details
        </button>
      </div>
      <ProofNodeDetails node={node} compact={!details} />
      {!details && <ExportNodeControl node={node} />}
    </div>
  );
}

export function ExportNodeControl({
  node,
  onOpenActions,
}: {
  node: ProofGraphNode;
  onOpenActions?: () => void;
}) {
  const selection = useProofSelection();
  if (!selection) return null;
  return (
    <div className="proof-node-control proof-export-control">
      <label className="check proof-restore-check">
        <input
          type="checkbox"
          checked={selection.included.has(node.pda)}
          disabled={selection.disabled || !node.record}
          aria-label={`Include record ${node.pda} in export`}
          onChange={(event) =>
            selection.onSelect([node.pda], event.target.checked)
          }
        />
        <Check size={15} aria-hidden="true" /> Include in export
      </label>
      {!node.record && (
        <p>
          Only a reference is saved. Import this record's data to include it.
        </p>
      )}
      {onOpenActions ? (
        <button
          type="button"
          className="proof-export-more"
          onClick={onOpenActions}
        >
          History selection actions
        </button>
      ) : (
        <ScopeActions node={node} />
      )}
    </div>
  );
}

function ScopeActions({ node }: { node: ProofGraphNode }) {
  const selection = useProofSelection()!;
  const [scope, setScope] = useState<ProofSelectionScope>("record");
  const records = useMemo(
    () => proofSelectionScope(selection.graph, [node.pda], scope),
    [selection.graph, node.pda, scope],
  );
  const { onPreview } = selection;
  useEffect(() => {
    onPreview(records);
    return () => onPreview(undefined);
  }, [onPreview, records]);
  const included = [...records].filter((pda) =>
    selection.included.has(pda),
  ).length;
  return (
    <div className="proof-scope-actions">
      <div
        className="proof-scope-options"
        role="group"
        aria-label="Selection scope"
      >
        {scopes.map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <p role="status">
        {records.size} {records.size === 1 ? "record" : "records"} in scope ·{" "}
        {included} included
      </p>
      <p className="proof-scope-hint">
        {scope === "record"
          ? "Only this record changes."
          : scope === "history"
            ? "This record and all its earlier dependencies and group members."
            : scope === "continuations"
              ? "This record and all versions or groups derived from it."
              : "The entire connected history, including shared branches."}
      </p>
      <div className="proof-scope-buttons">
        <button
          type="button"
          disabled={selection.disabled || included === records.size}
          onClick={() => selection.onSelect(records, true)}
        >
          Include {records.size - included}
        </button>
        <button
          type="button"
          disabled={selection.disabled || !included}
          onClick={() => selection.onSelect(records, false)}
        >
          Exclude {included}
        </button>
      </div>
    </div>
  );
}
