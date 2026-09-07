import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Download, RefreshCw } from "lucide-react";
import {
  decodeHashSource,
  accountPublicKey,
  to32Bytes,
} from "../../contract/sdk";
import type { RestoreProofInput } from "../../contract/sdk";
import { PROGRAM_ID } from "../../contract/client";
import { resolveRecord } from "../../contract/records";
import { useNetwork } from "../../contract/network";
import { useContract } from "../workspace/use-contract";
import { errorMessage, hex, timestamp } from "../workspace/values";
import { useCheck } from "../workspace/use-check";
import { Field, Identifier, Notice } from "../workspace/fields";
import { collectProof } from "../history/collect-proof";
import { downloadJson, proofJson } from "../history/proof-format";

export function RecordPanel({
  selected,
  onSelect,
  disabled,
  history,
  onProof,
  onAction,
}: {
  selected: string;
  onSelect(id: string): void;
  disabled: boolean;
  history: RestoreProofInput[];
  onProof(proof: RestoreProofInput[]): void;
  onAction(action: "vote" | "unvote" | "verify", id: string): void;
}) {
  const [input, setInput] = useState(selected);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [withdrawConfirmed, setWithdrawConfirmed] = useState(false);
  const { client, wallet } = useContract();
  const { network } = useNetwork();
  const lookup = useCheck<Awaited<ReturnType<typeof resolveRecord>>>(
    `${network.endpoint}:${input}`,
  );
  const record = useQuery({
    queryKey: ["record", network.endpoint, selected],
    queryFn: async () => (await resolveRecord(client, selected)).account,
    enabled: /^[a-f0-9]{64}$/i.test(selected),
  });
  const vote = useQuery({
    queryKey: [
      "vote",
      network.endpoint,
      selected,
      wallet?.publicKey.toBase58(),
    ],
    queryFn: () => client.fetchVoteInfo(selected, wallet!.publicKey),
    enabled: Boolean(record.data && wallet),
  });
  const source = record.data ? decodeHashSource(record.data.source) : null;
  return (
    <section className="panel">
      <div className="section-heading">
        <Search />
        <div>
          <h2>Inspect a record</h2>
          <p>Read chain state without connecting a wallet.</p>
        </div>
      </div>
      <form
        className="lookup"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setWithdrawConfirmed(false);
          const resolved = await lookup.run(() => resolveRecord(client, input));
          if (resolved) {
            onSelect(resolved.id);
            if (resolved.id === selected) {
              void record.refetch();
              if (wallet) void vote.refetch();
            }
          }
        }}
      >
        <Field
          label="Canonical ID or account PDA"
          hint="Canonical ID in hex or Base58, or a Base58 record PDA. Use id: or pda: to specify the type (including hex PDAs). Not a raw file hash."
        >
          {(id) => (
            <input
              id={id}
              className="mono"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
            />
          )}
        </Field>
        <button disabled={lookup.pending}>
          {lookup.pending ? "Looking up…" : "Look up"}
        </button>
      </form>
      {lookup.error && <Notice error>{lookup.error}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {record.isFetching && <p role="status">Reading chain state…</p>}
      {record.error && (
        <Notice error>RPC read failed: {errorMessage(record.error)}</Notice>
      )}
      {record.isSuccess && !record.data && (
        <Notice>
          No live record was found. It may never have been registered, or its
          final vote was removed. This does not disprove retained history.
        </Notice>
      )}
      {record.data && source && (
        <>
          <div className="record-heading">
            <span className="badge">{source.kind}</span>
            <button
              type="button"
              onClick={() => {
                void record.refetch();
                if (wallet) void vote.refetch();
              }}
              aria-label="Refresh record"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
          <Identifier label="Canonical ID" value={selected} />
          <Identifier label="Stored hash" value={hex(record.data.hash)} />
          <Identifier
            label="Account PDA"
            value={client.hashPda(selected).toBase58()}
          />
          <dl className="stats">
            <div>
              <dt>Chain timestamp</dt>
              <dd>{timestamp(record.data.createdAt)}</dd>
            </div>
            <div>
              <dt>Active votes</dt>
              <dd>{record.data.voters.toString()}</dd>
            </div>
            <div>
              <dt>Your vote</dt>
              <dd>
                {!wallet
                  ? "Wallet not connected"
                  : vote.isError
                    ? "Read failed"
                    : vote.isFetching
                      ? "Loading…"
                      : vote.data
                        ? `${vote.data.amount.toString()} lamports claim`
                        : "None"}
              </dd>
            </div>
          </dl>
          {source.kind === "branch" && (
            <>
              <Identifier
                label="Parent canonical ID"
                value={hex(to32Bytes(source.previousHashId))}
              />
              <button
                type="button"
                onClick={() => onSelect(hex(to32Bytes(source.previousHashId)))}
              >
                Inspect parent
              </button>
              <Identifier
                label="Branch payload"
                value={hex(to32Bytes(source.payload))}
              />
              <p>Generation {source.generation.toString()}</p>
            </>
          )}
          {source.kind === "batch" && (
            <div>
              <h3>Ordered members</h3>
              {source.members.map((member, index) => (
                <div key={index}>
                  <Identifier
                    label={`Member ${index + 1}`}
                    value={hex(to32Bytes(member))}
                  />
                  <button
                    type="button"
                    onClick={() => onSelect(hex(to32Bytes(member)))}
                  >
                    Inspect member {index + 1}
                  </button>
                </div>
              ))}
            </div>
          )}
          {source.kind === "account" && (
            <Identifier
              label="Target Solana account"
              value={accountPublicKey(source.account).toBase58()}
            />
          )}
          {source.kind === "pack" && (
            <Notice>
              Pack membership is committed in its digest, but not stored
              on-chain. Keep its proof export.
            </Notice>
          )}
          <div className="actions">
            <button
              disabled={
                disabled ||
                vote.isFetching ||
                vote.isError ||
                Boolean(vote.data) ||
                record.isError
              }
              onClick={() => onAction("vote", selected)}
            >
              Add vote
            </button>
            <button
              disabled={disabled || record.isError}
              onClick={() => onAction("verify", selected)}
            >
              Verify on-chain — fee
            </button>
            <button
              disabled={exporting || record.isError}
              onClick={async () => {
                setError("");
                setExporting(true);
                try {
                  const proof = await collectProof(client, selected, history);
                  downloadJson(
                    `proof-${selected.slice(0, 12)}.json`,
                    proofJson(proof, PROGRAM_ID.toBase58(), network.endpoint),
                  );
                  try {
                    onProof(proof);
                  } catch (caught) {
                    setError(
                      `Proof downloaded, but not merged into this tab: ${errorMessage(caught)}`,
                    );
                  }
                } catch (caught) {
                  setError(errorMessage(caught));
                } finally {
                  setExporting(false);
                }
              }}
            >
              <Download size={15} />{" "}
              {exporting ? "Collecting…" : "Download proof"}
            </button>
          </div>
          {vote.data && (
            <div className="danger-zone">
              <label className="check">
                <input
                  type="checkbox"
                  checked={withdrawConfirmed}
                  onChange={(event) =>
                    setWithdrawConfirmed(event.target.checked)
                  }
                />
                I understand: removing the final vote closes this record. I have
                saved any history I need.
              </label>
              <button
                className="danger"
                disabled={
                  disabled ||
                  !withdrawConfirmed ||
                  record.isError ||
                  vote.isError
                }
                onClick={() => {
                  setWithdrawConfirmed(false);
                  onAction("unvote", selected);
                }}
              >
                Withdraw my vote
              </button>
            </div>
          )}
        </>
      )}
      {!selected && (
        <div className="empty-state">
          Paste a canonical ID, or inspect the identity calculated from your
          file.
        </div>
      )}
    </section>
  );
}
