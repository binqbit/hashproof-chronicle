import { useState } from "react";
import type { OperationProps as Props } from "../workspace/operation-types";
import * as operations from "../workspace/operations";
import { Field, Identifier, Notice } from "../workspace/fields";
import { useContract } from "../workspace/use-contract";
import { useCheck } from "../workspace/use-check";
import { useNetwork } from "../../contract/network";
import { checkAggregate } from "./preflight";
import { SelectField } from "../../components/SelectField";
import {
  AggregateProofPicker,
  type AggregateFileSelection,
} from "./AggregateProofPicker";
import { mergeHistory } from "../history/collect-proof";

export function AggregatePanel({ disabled, history, run }: Props) {
  const [kind, setKind] = useState<"batch" | "pack">("batch");
  const [members, setMembers] = useState("");
  const [inputMode, setInputMode] = useState("files");
  const [fileSelection, setFileSelection] = useState<AggregateFileSelection>({
    ids: [],
    history: [],
    pending: false,
    revision: 0,
  });
  const { client } = useContract();
  const { network, busy } = useNetwork();
  const input = inputMode === "files" ? fileSelection.ids.join("\n") : members;
  const importedHistory = inputMode === "files" ? fileSelection.history : [];
  const check = useCheck<Awaited<ReturnType<typeof checkAggregate>>>(
    JSON.stringify([
      network.endpoint,
      kind,
      input,
      inputMode,
      fileSelection.revision,
    ]),
  );
  const hasMembers = /[^\s,]/.test(input);
  const canCheck =
    hasMembers && !busy && !check.pending && !fileSelection.pending;
  const canSubmit = canCheck && !disabled;
  return (
    <section className="panel">
      <h2>Combine records</h2>
      <p>
        Member order affects the resulting identity. Members must be live and
        unique. Existing votes are not withdrawn.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          void run(`Create ${kind}`, async (signingClient) => {
            const retained = mergeHistory(history, importedHistory);
            const result = await checkAggregate(
              signingClient,
              kind,
              input,
              importedHistory,
            );
            return operations.aggregate(
              signingClient,
              kind,
              result.members.map((member) => member.id),
              retained,
              importedHistory,
            );
          });
        }}
      >
        <Field label="Aggregate mode">
          {(id) => (
            <SelectField
              id={id}
              label="Aggregate mode"
              value={kind}
              onChange={(value) => setKind(value as "batch" | "pack")}
              disabled={busy}
              options={[
                { key: "batch", label: "Batch — stores ordered member IDs" },
                { key: "pack", label: "Pack — digest only" },
              ]}
            />
          )}
        </Field>
        <Field label="Choose records using">
          {(id) => (
            <SelectField
              id={id}
              label="Choose records using"
              value={inputMode}
              options={[
                { key: "files", label: "Proof files" },
                { key: "manual", label: "Enter IDs manually" },
              ]}
              disabled={busy}
              onChange={(value) => {
                setInputMode(value);
                setFileSelection({
                  ids: [],
                  history: [],
                  pending: false,
                  revision: 0,
                });
              }}
            />
          )}
        </Field>
        {inputMode === "files" ? (
          <AggregateProofPicker disabled={busy} onChange={setFileSelection} />
        ) : (
          <Field
            label="Ordered canonical IDs or PDAs"
            hint="IDs accept hex or Base58; PDAs use Base58 or pda:<hex>. One per line or comma-separated, at most 32 members. Aliases count as duplicates."
          >
            {(id) => (
              <textarea
                id={id}
                rows={6}
                className="mono"
                value={members}
                onChange={(event) => setMembers(event.target.value)}
                disabled={busy}
                required
              />
            )}
          </Field>
        )}
        {kind === "pack" && (
          <Notice>
            Pack does not retain its member list on-chain. Download the
            resulting proof; without the fingerprints, recovery may be
            impossible.
          </Notice>
        )}
        {check.error && <Notice error>{check.error}</Notice>}
        <button
          type="button"
          disabled={!canCheck}
          onClick={() => {
            if (canCheck)
              void check.run(() => {
                mergeHistory(history, importedHistory);
                return checkAggregate(client, kind, input, importedHistory);
              });
          }}
        >
          {check.pending ? "Checking…" : "Check members & preview — no fee"}
        </button>
        {check.value && (
          <div className="identity-box">
            {check.value.members.map((member, index) => (
              <Identifier
                key={member.id}
                label={`Member ${index + 1} — live`}
                value={member.id}
              />
            ))}
            <Identifier
              label={`New ${kind} canonical ID`}
              value={check.value.id}
            />
            <Identifier
              label={`New ${kind} PDA`}
              value={check.value.pda.toBase58()}
            />
            <p>
              Member order preserved. State is checked again before submission.
            </p>
          </div>
        )}
        <button className="primary" disabled={!canSubmit}>
          Create {kind} + first vote
        </button>
      </form>
    </section>
  );
}
