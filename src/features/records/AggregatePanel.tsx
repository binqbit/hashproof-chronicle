import { useState } from "react";
import type { OperationProps as Props } from "../workspace/operation-types";
import * as operations from "../workspace/operations";
import { Field, Identifier, Notice } from "../workspace/fields";
import { useContract } from "../workspace/use-contract";
import { useCheck } from "../workspace/use-check";
import { useNetwork } from "../../contract/network";
import { checkAggregate } from "./preflight";
import { SelectField } from "../../components/SelectField";

export function AggregatePanel({ disabled, history, run }: Props) {
  const [kind, setKind] = useState<"batch" | "pack">("batch");
  const [members, setMembers] = useState("");
  const { client } = useContract();
  const { network, busy } = useNetwork();
  const check = useCheck<Awaited<ReturnType<typeof checkAggregate>>>(
    JSON.stringify([network.endpoint, kind, members]),
  );
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
          void run(`Create ${kind}`, async (signingClient) => {
            const result = await checkAggregate(signingClient, kind, members);
            return operations.aggregate(
              signingClient,
              kind,
              result.members.map((member) => member.id),
              history,
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
        <Field
          label="Ordered canonical IDs or PDAs"
          hint="Mix IDs and PDAs, one per line or comma-separated. At most 32 members; aliases of the same record count as duplicates."
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
          disabled={busy || check.pending || !members}
          onClick={() =>
            void check.run(() => checkAggregate(client, kind, members))
          }
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
        <button className="primary" disabled={disabled}>
          Create {kind} + first vote
        </button>
      </form>
    </section>
  );
}
