import { useEffect, useRef, useState } from "react";
import { Download, Files, Loader2, Merge, X } from "lucide-react";
import { PROGRAM_ID } from "../../contract/client";
import { FilePicker } from "../workspace/FilePicker";
import { Identifier, Notice } from "../workspace/fields";
import { errorMessage } from "../workspace/values";
import { downloadJson } from "./proof-format";
import {
  mergeProofFiles,
  validateProofFiles,
  type MergedProofFiles,
} from "./archive-files";
import "./proofs.css";

export function ProofsPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<MergedProofFiles | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const job = useRef<AbortController | null>(null);
  useEffect(() => () => job.current?.abort(), []);

  const changeFiles = (next: File[]) => {
    job.current?.abort();
    setPending(false);
    setResult(null);
    setError("");
    try {
      validateProofFiles(next);
      setFiles(next);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };
  const merge = async () => {
    job.current?.abort();
    const controller = new AbortController();
    job.current = controller;
    setPending(true);
    setResult(null);
    setError("");
    try {
      const merged = await mergeProofFiles(
        files,
        PROGRAM_ID.toBase58(),
        controller.signal,
      );
      if (!controller.signal.aborted) setResult(merged);
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorMessage(caught));
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  };
  const nodes = result ? Object.keys(result.archive.nodes).length : 0;

  return (
    <section className="panel" aria-labelledby="proofs-heading">
      <h2 id="proofs-heading">Merge proofs</h2>
      <p>
        Combine saved history into one JSON archive. Files are read locally; no
        wallet, RPC or transaction is needed.
      </p>
      <FilePicker
        multiple
        label="Add proof JSON files"
        prompt="Choose proof files to combine"
        hint="SDK archives or legacy proof JSON · up to 32 files, 16 MiB each, 32 MiB total."
        accept="application/json,.json"
        fileName={files.length ? `${files.length} files selected` : ""}
        disabled={pending}
        onSelect={(selected) => changeFiles([...files, ...selected])}
      />
      {!!files.length && (
        <ul className="proof-file-list" aria-label="Selected proof files">
          {files.map((file, index) => (
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
                onClick={() => changeFiles(files.filter((_, i) => i !== index))}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button
          type="button"
          className="primary"
          disabled={files.length < 2 || pending}
          onClick={() => void merge()}
        >
          {pending ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Merge size={16} aria-hidden="true" />
          )}
          {pending ? "Combining files…" : "Merge files"}
        </button>
        {!!files.length && (
          <button type="button" onClick={() => changeFiles([])}>
            {pending ? "Cancel & clear" : "Clear files"}
          </button>
        )}
      </div>
      {pending && (
        <p role="status">Reading files and checking archive links…</p>
      )}
      {error && <Notice error>{error}</Notice>}
      {result && (
        <div className="identity-box" aria-label="Merged proof archive">
          <h3>Archive ready</h3>
          <p role="status">
            {files.length} files → {nodes} unique nodes.{" "}
            {result.inputNodes - nodes} overlapping nodes combined.
          </p>
          <Identifier label="Program ID" value={result.archive.programId} />
          {result.inspection.complete ? (
            <p>All referenced nodes and restoration witnesses are present.</p>
          ) : (
            <Notice>
              Partial history: {result.inspection.missingNodes.length} missing
              node references, {result.inspection.missingWitnesses.length}{" "}
              missing witnesses. You can save this archive and merge more
              history later.
            </Notice>
          )}
          {!!result.convertedFiles && (
            <Notice>
              {result.convertedFiles} legacy proof files converted to the SDK
              archive format. RPC metadata is not retained; check the original
              network before restoration. Plain proof arrays use this app's
              program ID.
            </Notice>
          )}
          <button
            type="button"
            className="primary"
            onClick={() =>
              downloadJson("hash-timestamp-archive.json", result.json)
            }
          >
            <Download size={16} aria-hidden="true" />
            Download merged JSON
          </button>
        </div>
      )}
      <p className="fine-print">
        Matching nodes are combined without changing history. Different program
        IDs, timestamps or conflicting witnesses block the merge. Local checks
        do not prove on-chain existence. The output is an SDK archive, not a
        ready-to-submit Restore proof chain.
      </p>
    </section>
  );
}
