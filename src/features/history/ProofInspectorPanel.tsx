import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Network } from "lucide-react";
import { PROGRAM_ID } from "../../contract/client";
import { FilePicker } from "../workspace/FilePicker";
import { Identifier, Notice } from "../workspace/fields";
import { errorMessage } from "../workspace/values";
import { readArchiveFiles } from "./archive-files";
import { buildProofGraph, type ProofGraph } from "./proof-graph";
import "./proof-inspector.css";

const ProofGraphViewer = lazy(() => import("./ProofGraphViewer"));

export function ProofInspectorPanel() {
  const [graph, setGraph] = useState<ProofGraph | null>(null);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [importId, setImportId] = useState(0);
  const job = useRef<AbortController>();
  useEffect(() => () => job.current?.abort(), []);

  const clear = () => {
    job.current?.abort();
    setImportId((previous) => previous + 1);
    setGraph(null);
    setFileName("");
    setReading(false);
    setError("");
  };
  const load = async (file: File) => {
    clear();
    const controller = new AbortController();
    job.current = controller;
    setFileName(file.name);
    setReading(true);
    try {
      // No network binding: this inspector only reads saved files, even for another program.
      const loaded = await readArchiveFiles([file], PROGRAM_ID.toBase58(), {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setGraph(buildProofGraph(loaded.archive));
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorMessage(caught));
    } finally {
      if (!controller.signal.aborted) setReading(false);
    }
  };

  return (
    <section className="panel" aria-labelledby="proof-inspector-heading">
      <div className="section-heading">
        <Network aria-hidden="true" />
        <div>
          <h2 id="proof-inspector-heading">Inspect proof history</h2>
          <p>
            Explore records, their connections and independent histories in a
            saved proof.
          </p>
        </div>
      </div>
      <FilePicker
        label="Proof file to inspect"
        prompt="Choose a proof file to explore"
        hint="Original or combined JSON proof · read locally, up to 16 MiB."
        accept="application/json,.json"
        fileName={fileName}
        onSelect={(file) => void load(file)}
      />
      {!!fileName && (
        <button type="button" onClick={clear}>
          {reading ? "Cancel & clear" : "Clear proof"}
        </button>
      )}
      {reading && <p role="status">Reading proof history…</p>}
      {error && <Notice error>{error}</Notice>}
      {graph && (
        <div
          key={importId}
          className="proof-inspector-result"
          aria-label="Proof history inspector"
        >
          <p role="status">
            {Object.keys(graph.archive.nodes).length} records ·{" "}
            {graph.components.length} independent histories in this file.
          </p>
          <Notice>
            Read from a latest endpoint down to earlier versions or group
            members. Shared records are linked, not duplicated. Missing links
            can hide connections between histories. This view does not confirm
            records on the network.
          </Notice>
          <details className="proof-archive-info">
            <summary>About this proof</summary>
            <Identifier label="Program ID" value={graph.archive.programId} />
            <p>
              {graph.inspection.complete
                ? "All referenced records and supporting data are present."
                : `${graph.inspection.missingNodes.length} missing records · ${graph.inspection.missingWitnesses.length} records missing membership or snapshots.`}
            </p>
          </details>
          {!graph.components.length && (
            <p className="empty">This proof contains no records.</p>
          )}
          {!!graph.components.length && (
            <Suspense fallback={<p role="status">Loading graph viewer…</p>}>
              <ProofGraphViewer graph={graph} />
            </Suspense>
          )}
        </div>
      )}
      <p className="fine-print">
        No wallet, upload or fee. Timestamps belong to individual records, not
        to the whole tree. Use Verify → Proof check to check a file against
        saved history.
      </p>
    </section>
  );
}
