import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { History } from "lucide-react";
import type { OperationProps } from "../workspace/operation-types";
import type { ArchiveRestorePlan, RestoreProofInput } from "../../contract/sdk";
import { PROGRAM_ID } from "../../contract/client";
import { useNetwork } from "../../contract/network";
import { Identifier, Notice } from "../workspace/fields";
import { FilePicker } from "../workspace/FilePicker";
import { errorMessage } from "../workspace/values";
import { useContract } from "../workspace/use-contract";
import { useCheck } from "../workspace/use-check";
import { readArchiveFiles } from "./archive-files";
import { historyFromArchive } from "./archive-history";
import { buildProofGraph, type ProofGraph } from "./proof-graph";
import { useRestoreAnchors } from "./use-restore-anchors";
import {
  executeGraphRestore,
  planGraphRestore,
  restoreGraphHighlight,
} from "./restore-graph";
import "./proof-inspector.css";

const ProofGraphViewer = lazy(() => import("./ProofGraphViewer"));

export function RestorePanel({
  disabled,
  run,
  onHistory,
}: OperationProps & {
  onHistory(proof: RestoreProofInput[]): void;
}) {
  const { network, busy } = useNetwork();
  const { client, wallet } = useContract();
  const [graph, setGraph] = useState<ProofGraph>();
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [planning, setPlanning] = useState(false);
  const [importId, setImportId] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState(0);
  const live = useRestoreAnchors(client, graph?.archive, review);
  const job = useRef<AbortController>();
  useEffect(() => () => job.current?.abort(), []);
  const check = useCheck<ArchiveRestorePlan>(
    JSON.stringify([
      importId,
      selected,
      network.endpoint,
      wallet?.publicKey.toBase58(),
      review,
    ]),
  );
  const clear = () => {
    job.current?.abort();
    setImportId((id) => id + 1);
    setGraph(undefined);
    setSelected([]);
    setFileName("");
    setReading(false);
    setError("");
    setWarning("");
  };
  const load = async (file: File) => {
    clear();
    const controller = new AbortController();
    job.current = controller;
    setFileName(file.name);
    setReading(true);
    try {
      const loaded = await readArchiveFiles([file], PROGRAM_ID.toBase58(), {
        signal: controller.signal,
        rpc: network.endpoint,
      });
      if (controller.signal.aborted) return;
      const next = buildProofGraph(loaded.archive);
      setGraph(next);
      try {
        onHistory(historyFromArchive(loaded.archive).map(({ entry }) => entry));
      } catch (caught) {
        setWarning(
          `The file is loaded, but could not be combined with session history. ${errorMessage(caught)}`,
        );
      }
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorMessage(caught));
    } finally {
      if (!controller.signal.aborted) setReading(false);
    }
  };
  const onToggle = useCallback(
    (pda: string) => {
      const known = live.records?.get(pda);
      if (
        busy ||
        live.pending ||
        known?.kind === "live" ||
        known?.kind === "conflict"
      )
        return;
      setSelected((previous) =>
        previous.includes(pda)
          ? previous.filter((value) => value !== pda)
          : [...previous, pda].sort(),
      );
    },
    [busy, live.pending, live.records],
  );
  const highlight = useMemo(
    () =>
      graph &&
      restoreGraphHighlight(graph, check.value, live.records, selected),
    [graph, check.value, live.records, selected],
  );
  useEffect(() => {
    setSelected((previous) => {
      const next = previous.filter(
        (pda) =>
          !highlight?.present.has(pda) &&
          live.records?.get(pda)?.kind !== "conflict",
      );
      return next.length === previous.length ? previous : next;
    });
  }, [highlight, live.records]);
  const interaction = useMemo(
    () =>
      highlight && {
        ...highlight,
        selected: new Set(selected),
        records: live.records,
        disabled: busy || live.pending,
        onToggle,
      },
    [highlight, selected, busy, onToggle, live.records, live.pending],
  );
  const canCheck = Boolean(
    graph && selected.length && !reading && !busy && !planning && !live.pending,
  );
  const required = highlight?.required ?? new Set<string>();
  const canSubmit = Boolean(
    canCheck && !disabled && check.value?.steps.length && !required.size,
  );

  return (
    <section className="panel" aria-labelledby="restore-heading">
      <div className="section-heading">
        <History aria-hidden="true" />
        <div>
          <h2 id="restore-heading">Restore historical records</h2>
          <p>
            Choose a saved proof file, select records in the graph, then check
            their path to a live anchor.
          </p>
        </div>
      </div>
      <FilePicker
        label="Proof file to restore"
        prompt="Choose a saved proof"
        hint="Original or combined JSON proof · read locally, up to 16 MiB."
        accept="application/json,.json"
        fileName={fileName}
        disabled={busy}
        onSelect={(file) => void load(file)}
      />
      {!!fileName && (
        <button type="button" disabled={busy} onClick={clear}>
          {reading ? "Cancel & clear" : "Clear proof"}
        </button>
      )}
      {reading && <p role="status">Reading proof history…</p>}
      {error && <Notice error>{error}</Notice>}
      {warning && <Notice>{warning}</Notice>}
      {graph && (
        <div
          className="proof-inspector-result"
          aria-label="Restore proof selection"
        >
          <div className="restore-selection-summary">
            <p role="status">
              {graph.nodes.size} graph records · {selected.length} selected for
              restore
            </p>
            <button
              type="button"
              disabled={!selected.length || busy}
              onClick={() => setSelected([])}
            >
              Clear selection
            </button>
          </div>
          <div
            className="restore-selection-summary"
            aria-label="Live record check"
          >
            <p role="status">
              {live.pending
                ? "Checking existing records…"
                : live.records
                  ? `${[...live.records.values()].filter((state) => state.kind === "live").length} matching live record(s) found`
                  : "Existing records could not be checked."}
            </p>
            <button
              type="button"
              disabled={busy || planning || live.pending}
              onClick={() => setReview((value) => value + 1)}
            >
              Refresh live records
            </button>
          </div>
          {live.error && <Notice error>{live.error}</Notice>}
          {live.records &&
            [...live.records.values()].some(
              (state) => state.kind === "error" || state.kind === "conflict",
            ) && (
              <details className="proof-archive-info">
                <summary>
                  Some records could not be verified or differ from the saved
                  history
                </summary>
                {[...live.records]
                  .filter(
                    ([, state]) =>
                      state.kind === "error" || state.kind === "conflict",
                  )
                  .slice(0, 8)
                  .map(([pda, state]) => (
                    <p className="break-anywhere" key={pda}>
                      {pda}: {"message" in state ? state.message : ""}
                    </p>
                  ))}
                <p>
                  These records are not marked as live anchors. Showing up to 8
                  issues; refresh to check again.
                </p>
              </details>
            )}
          {!graph.nodes.size && (
            <p className="empty">This proof contains no records.</p>
          )}
          {!!graph.nodes.size && (
            <Suspense fallback={<p role="status">Loading graph viewer…</p>}>
              <ProofGraphViewer
                key={importId}
                graph={graph}
                restore={interaction}
              />
            </Suspense>
          )}
          <Notice>
            Select “Restore” in a circle's preview or full details. Marked
            circles are your selection. Green anchors match existing records;
            bright links show one shortest path to each selected record. After
            checking, paths start from the anchors chosen for Restore. Other
            group dependencies stay dim. Highlighting alone does not mean a transaction fits.
            Supporting proof records are not automatically selected.
          </Notice>
          <button
            type="button"
            disabled={!canCheck}
            onClick={() => {
              if (canCheck && graph) {
                setPlanning(true);
                void check
                  .run(() =>
                    planGraphRestore(
                      client,
                      graph.archive,
                      selected,
                      wallet?.publicKey,
                    ),
                  )
                  .finally(() => setPlanning(false));
              }
            }}
          >
            {planning
              ? "Checking restore paths…"
              : "Check selected records — no fee"}
          </button>
          {check.value && (
            <div
              className="identity-box restore-plan"
              aria-label="Restore plan"
            >
              <h3>
                {required.size
                  ? "Additional records are required"
                  : check.value.steps.length
                    ? "Restore paths checked"
                    : "Selected records already exist"}
              </h3>
              {!!check.value.alreadyPresent.length && (
                <p>
                  {check.value.alreadyPresent.length} selected record(s) already
                  match this history. No recreation is needed for them.
                </p>
              )}
              {check.value.steps.map((step, index) => (
                <div
                  key={step.anchor + "-" + index}
                  className="restore-plan-step"
                >
                  <Identifier
                    label={"Transaction " + (index + 1) + " · live anchor"}
                    value={step.anchor}
                  />
                  <p>
                    {step.expectedCreations.length} record(s) to recreate ·{" "}
                    {step.proof.length} supporting proof entries ·{" "}
                    {step.transactionBytes} / 1232 bytes
                  </p>
                </div>
              ))}
              {!!required.size && (
                <>
                  <Notice>
                    These intermediate records are required by the proof.
                    Nothing will be submitted until you explicitly select them
                    too.
                  </Notice>
                  {[...required].map((pda) => (
                    <Identifier key={pda} label="Required record" value={pda} />
                  ))}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setSelected((values) =>
                        [...new Set([...values, ...required])].sort(),
                      )
                    }
                  >
                    Select {required.size} required record(s)
                  </button>
                </>
              )}
              {!!check.value.steps.length && (
                <p className="fine-print">
                  Each transaction needs wallet approval and SOL for fees and
                  account storage. The network is checked again before sending;
                  a later transaction can fail after earlier ones confirm.
                </p>
              )}
            </div>
          )}
          {check.error && <Notice error>{check.error}</Notice>}
          <button
            className="primary"
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              const plan = check.value;
              if (!canSubmit || !plan) return;
              void run("Restore selected records", (signingClient) =>
                executeGraphRestore(
                  signingClient,
                  graph.archive,
                  selected,
                  plan,
                ),
              ).finally(() => setReview((value) => value + 1));
            }}
          >
            Restore selected records
            {check.value?.steps.length
              ? " · " + check.value.steps.length + " transaction(s)"
              : ""}
          </button>
        </div>
      )}
      <p className="fine-print">
        Reading the file and checking a path do not sign transactions. Restore
        brings back historical records, not file contents. Connect a wallet and
        check again before submitting.
      </p>
    </section>
  );
}
