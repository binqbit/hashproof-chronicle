import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Download, Files, Loader2, Undo2, X } from "lucide-react";
import { ConfirmationDialog } from "../../components/ConfirmationDialog";
import { FilePicker } from "../workspace/FilePicker";
import { Identifier, Notice } from "../workspace/fields";
import { downloadJson } from "./proof-format";
import { useProofManager } from "./use-proof-manager";
import { exportProofSelection, proofSelectionScope } from "./proof-selection";
import type { ProofSelectionInteraction } from "./ProofSelectionContext";
import "./proofs.css";
import "./proof-inspector.css";

const ProofGraphViewer = lazy(() => import("./ProofGraphViewer"));

export function ManageProofsPanel() {
  const manager = useProofManager();
  const { session, pending, error } = manager;
  const graph = session?.graph,
    included = session?.included;
  const [preview, setPreview] = useState<ReadonlySet<string>>();
  const [confirmPartial, setConfirmPartial] = useState(false);
  const output = useMemo(
    () =>
      graph && included ? exportProofSelection(graph, included) : undefined,
    [graph, included],
  );
  const needed = useMemo(
    () =>
      graph && included
        ? [...proofSelectionScope(graph, included, "history")].filter(
            (pda) => !included.has(pda),
          )
        : [],
    [graph, included],
  );
  useEffect(() => setPreview(undefined), [graph]);
  useEffect(() => setConfirmPartial(false), [output, pending]);
  const interaction: ProofSelectionInteraction | undefined = session && {
    graph: session.graph,
    included: session.included,
    preview,
    disabled: pending,
    onSelect: manager.select,
    onPreview: setPreview,
  };
  const download = () => {
    if (output && included?.size && !pending)
      downloadJson("hash-timestamp-archive.json", output.json);
  };

  return (
    <section className="panel" aria-labelledby="proofs-heading">
      <div className="section-heading">
        <Files aria-hidden="true" />
        <div>
          <h2 id="proofs-heading">Manage proofs</h2>
          <p>
            Combine proof files, choose the history to keep, and save your
            selection.
          </p>
        </div>
      </div>
      <FilePicker
        multiple
        label="Add proof JSON files"
        prompt="Open one or more proof files"
        hint="Original or combined JSON proof · up to 32 files, 16 MiB each, 32 MiB total."
        accept="application/json,.json"
        fileName={session ? `${session.files.length} files selected` : ""}
        disabled={pending}
        onSelect={(files) => void manager.addFiles(files)}
      />
      {!!session?.files.length && (
        <details className="proof-archive-info">
          <summary>Source files ({session.files.length})</summary>
          <ul className="proof-file-list" aria-label="Selected proof files">
            {session.files.map((file, index) => (
              <li key={index}>
                <Files size={18} aria-hidden="true" />
                <div>
                  <strong>{file.name}</strong>
                  <small>{(file.size / 1024).toFixed(1)} KiB</small>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  disabled={pending}
                  onClick={() => void manager.removeFile(index)}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <Identifier
            label="Program ID"
            value={session.graph.archive.programId}
          />
          <p>
            {session.inputNodes -
              Object.keys(session.graph.archive.nodes).length}{" "}
            overlapping records combined.
          </p>
          {!!session.convertedFiles && (
            <p>
              Older proof files were converted. Keep the originals to retain
              their network information.
            </p>
          )}
        </details>
      )}
      {(session || pending) && (
        <button type="button" onClick={manager.clear}>
          {pending ? "Cancel & clear" : "Clear files"}
        </button>
      )}
      {pending && (
        <p role="status">
          <Loader2 size={16} className="animate-spin" /> Reading and combining
          proof files…
        </p>
      )}
      {error && (
        <Notice error>
          {error}
          {session && " Your previous history and selection are unchanged."}
        </Notice>
      )}
      {session && output && (
        <div className="proof-inspector-result" aria-label="Proof manager">
          <div className="proof-manager-toolbar">
            <p role="status">
              {session.included.size} included ·{" "}
              {Object.keys(session.graph.archive.nodes).length -
                session.included.size}{" "}
              excluded · {session.graph.components.length} independent histories
            </p>
            <div className="actions">
              <button
                type="button"
                disabled={
                  pending ||
                  session.included.size ===
                    Object.keys(session.graph.archive.nodes).length
                }
                onClick={() =>
                  manager.select(Object.keys(session.graph.archive.nodes), true)
                }
              >
                Include all
              </button>
              <button
                type="button"
                disabled={pending || !session.included.size}
                onClick={() => manager.select(session.included, false)}
              >
                Exclude all
              </button>
              <button
                type="button"
                disabled={pending || !session.undo.length}
                onClick={manager.undo}
              >
                <Undo2 size={15} /> Undo selection
              </button>
            </div>
          </div>
          {session.graph.components.length > 0 ? (
            <Suspense fallback={<p role="status">Loading graph viewer…</p>}>
              <ProofGraphViewer
                key={session.version}
                graph={session.graph}
                selection={interaction}
              />
            </Suspense>
          ) : (
            <p className="empty">This archive contains no records.</p>
          )}
          <Notice>
            Included records are bright; excluded records remain visible and can
            be included again. Click a circle for previous history,
            continuations or the whole connected history. Selection changes only
            the export, not the source files or on-chain records.
          </Notice>
          <div
            className="identity-box proof-export-summary"
            aria-label="Export selection"
          >
            <h3>Save selected history</h3>
            {!session.included.size ? (
              <p>Select at least one record to save.</p>
            ) : output.inspection.complete ? (
              <p>
                All referenced records and supporting data are included. This is
                not network confirmation.
              </p>
            ) : (
              <Notice>
                Partial history: {output.inspection.missingNodes.length} missing
                records · {output.inspection.missingWitnesses.length} missing
                membership lists or snapshots. Excluded records are not silently
                added back. Missing history may prevent verification or
                restoration.
              </Notice>
            )}
            {!!needed.length && (
              <button
                type="button"
                disabled={pending}
                onClick={() => manager.select(needed, true)}
              >
                Add needed history (+{needed.length})
              </button>
            )}
            <button
              type="button"
              className="primary"
              id="proof-manager-download"
              disabled={pending || !session.included.size}
              onClick={() =>
                output.inspection.complete
                  ? download()
                  : setConfirmPartial(true)
              }
            >
              <Download size={16} /> Download selected proof
            </button>
          </div>
        </div>
      )}
      <ConfirmationDialog
        open={confirmPartial}
        onOpenChange={setConfirmPartial}
        title="Save incomplete history?"
        description="The file will contain exactly the included records. Some references or supporting data are missing, so it may not be enough to verify or restore every record. Keep your original proof files."
        confirmLabel="Download partial proof"
        onConfirm={download}
        disabled={pending || !included?.size}
        returnFocusId="proof-manager-download"
      />
      <p className="fine-print">
        Files stay on your device. No wallet, network check or transaction is
        needed. Record identities, timestamps and group membership never change.
      </p>
    </section>
  );
}
