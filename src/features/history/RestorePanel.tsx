import { useRef, useState } from "react";
import type { OperationProps as Props } from "../workspace/operation-types";
import * as operations from "../workspace/operations";
import type { RestoreProofInput } from "../../contract/sdk";
import { PROGRAM_ID } from "../../contract/client";
import { useNetwork } from "../../contract/network";
import { Field, Identifier, Notice } from "../workspace/fields";
import { FilePicker } from "../workspace/FilePicker";
import { errorMessage } from "../workspace/values";
import { parseProof } from "./proof-format";
import { entryId } from "./collect-proof";
import { useContract } from "../workspace/use-contract";
import { useCheck } from "../workspace/use-check";
import { checkRestore, type RestoreCheck } from "./check-restore";

export function RestorePanel({
  disabled,
  run,
  onHistory,
}: Props & { onHistory(proof: RestoreProofInput[]): void }) {
  const { network, busy } = useNetwork();
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<RestoreProofInput[] | null>(null);
  const [create, setCreate] = useState(false);
  const [error, setError] = useState("");
  const { client, wallet } = useContract();
  const importRequest = useRef(0);
  const check = useCheck<RestoreCheck>(
    JSON.stringify([
      input,
      create,
      network.endpoint,
      wallet?.publicKey.toBase58(),
    ]),
  );
  const parse = () =>
    parseProof(input, {
      programId: PROGRAM_ID.toBase58(),
      rpc: network.endpoint,
    });
  return (
    <section className="panel">
      <h2>Restore historical records</h2>
      <p>
        Supply retained history anchored by a live record at index zero. Restore
        cannot recover file contents or discover missing history.
      </p>
      <FilePicker
        label="Import proof JSON"
        prompt="Choose a saved proof"
        hint="Proof JSON · up to 2 MB. Read locally, or paste the proof below."
        fileName={fileName}
        accept="application/json,.json"
        disabled={busy}
        onSelect={async (file) => {
          const request = ++importRequest.current;
          setPreview(null);
          setFileName("");
          setError("");
          try {
            if (file.size > 2_000_000)
              throw new Error("Proof import is limited to 2 MB.");
            const contents = await file.text();
            if (request === importRequest.current) {
              setInput(contents);
              setFileName(file.name);
            }
          } catch (caught) {
            if (request === importRequest.current)
              setError(errorMessage(caught));
          }
        }}
      />
      <Field
        label="Proof chain JSON"
        hint="Portable proof export or SDK-shaped array. Hashes accept hex, Base58 or byte arrays; raw payload/data accepts hex or byte arrays. Use decimal strings for large integers."
      >
        {(id) => (
          <textarea
            id={id}
            rows={10}
            className="mono"
            value={input}
            onChange={(event) => {
              importRequest.current++;
              setInput(event.target.value);
              setFileName("");
              setPreview(null);
              setError("");
            }}
            disabled={busy}
          />
        )}
      </Field>
      <button
        disabled={!input || busy}
        onClick={() => {
          setError("");
          setPreview(null);
          try {
            const proof = parse();
            onHistory(proof);
            setPreview(proof);
          } catch (caught) {
            setError(errorMessage(caught));
          }
        }}
      >
        Check format & load history
      </button>
      {preview && (
        <>
          <div className="identity-box">
            <Identifier
              label="Live anchor canonical ID"
              value={entryId(preview[0])}
            />
            <p>
              {preview.length} proof entries. Format checked locally; historical
              validity must still be checked on-chain.
            </p>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={create}
              onChange={(event) => setCreate(event.target.checked)}
              disabled={busy}
            />
            Recreate every non-anchor record with parameters
          </label>
          <Notice>
            {create
              ? "May allocate hash/vote accounts and spend SOL on rent. Existing records must match the proven historical incarnation."
              : "Proof-only mode: no ancestor accounts are requested, but this is still an on-chain transaction with fees."}{" "}
            Large chains or snapshots may exceed a single transaction; the SDK
            does not split them.
          </Notice>
          <button
            type="button"
            disabled={busy || check.pending}
            onClick={() =>
              void check.run(() =>
                checkRestore(client, parse(), create, wallet?.publicKey),
              )
            }
          >
            {check.pending
              ? "Checking proof and accounts…"
              : "Check proof & live state — no fee"}
          </button>
          {check.value && (
            <div className="identity-box" aria-label="Restore preflight">
              <h3>
                {check.value.errors.length
                  ? "Preflight found problems"
                  : "Preflight checks passed"}
              </h3>
              {check.value.nodes.map((node, index) => (
                <div key={node.id}>
                  <Identifier
                    label={`Entry ${index} — ${node.state}`}
                    value={node.id}
                  />
                </div>
              ))}
              {check.value.transactionBytes !== undefined && (
                <p>
                  Encoded transaction: {check.value.transactionBytes} / 1232
                  bytes.
                </p>
              )}
              {check.value.errors.map((message, index) => (
                <Notice error key={index}>
                  {message}
                </Notice>
              ))}
              {check.value.warnings.map((message, index) => (
                <Notice key={index}>{message}</Notice>
              ))}
            </div>
          )}
          <button
            className="primary"
            disabled={
              disabled ||
              check.pending ||
              !check.value ||
              check.value.errors.length > 0
            }
            onClick={() => {
              setError("");
              try {
                const proof = parse();
                void run(
                  create ? "Restore records" : "Validate proof on-chain",
                  (client) => operations.restore(client, proof, create),
                );
              } catch (caught) {
                setError(errorMessage(caught));
              }
            }}
          >
            {create ? "Restore records" : "Validate proof on-chain — fee"}
          </button>
        </>
      )}
      {check.error && <Notice error>{check.error}</Notice>}
      {error && <Notice error>{error}</Notice>}
    </section>
  );
}
