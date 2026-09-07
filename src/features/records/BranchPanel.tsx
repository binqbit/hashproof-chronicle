import { useState } from "react";
import type { OperationProps as Props } from "../workspace/operation-types";
import * as operations from "../workspace/operations";
import { Field, Identifier, Notice } from "../workspace/fields";
import { hashInput, errorMessage } from "../workspace/values";
import { useContract } from "../workspace/use-contract";
import { useCheck } from "../workspace/use-check";
import { useNetwork } from "../../contract/network";
import { checkBranch } from "./preflight";
import { useFileDigest } from "./use-file-digest";
import { FileDigestFields } from "./FileDigestFields";

export function BranchPanel({ disabled, selected, history, run }: Props) {
  const [parent, setParent] = useState(selected);
  const digest = useFileDigest();
  const payload = digest.value;
  const [takeVote, setTakeVote] = useState(false);
  const [error, setError] = useState("");
  const { client, wallet } = useContract();
  const { network, busy } = useNetwork();
  const check = useCheck<Awaited<ReturnType<typeof checkBranch>>>(
    JSON.stringify([
      network.endpoint,
      wallet?.publicKey.toBase58(),
      parent,
      payload,
      takeVote,
    ]),
  );
  const hasInputs = Boolean(parent.trim() && payload.trim());
  const canCheck = hasInputs && !busy && !digest.hashing && !check.pending;
  const canSubmit = canCheck && !disabled;
  return (
    <section className="panel">
      <h2>Create a branch</h2>
      <p>
        Select the previous record and a new version of your file, or paste its
        digest. A branch links the new commitment to the previous record without
        overwriting it. Files are hashed locally and are not uploaded.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          setError("");
          try {
            const bytes = hashInput(payload);
            void run("Create branch", async (signingClient) => {
              const result = await checkBranch(
                signingClient,
                parent,
                bytes,
                takeVote,
                wallet?.publicKey,
              );
              return operations.branch(
                signingClient,
                result.parent.id,
                bytes,
                takeVote,
                history,
              );
            });
          } catch (caught) {
            setError(errorMessage(caught));
          }
        }}
      >
        <Field
          label="Parent canonical ID or PDA"
          hint="Live record ID in hex or Base58, or its Base58 PDA. Use id: or pda: to specify the type, including hex PDAs."
        >
          {(id) => (
            <input
              id={id}
              className="mono"
              value={parent}
              onChange={(event) => setParent(event.target.value)}
              required
              disabled={busy}
            />
          )}
        </Field>
        <FileDigestFields
          digest={digest}
          fileLabel="New file version"
          inputLabel="New payload / file digest"
          prompt="Choose a new file version"
          disabled={busy}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={takeVote}
            onChange={(event) => setTakeVote(event.target.checked)}
            disabled={busy}
          />
          Withdraw my parent vote after creating the child
        </label>
        {takeVote && (
          <Notice>
            This can close the parent if yours is its last vote. Save its proof
            first. Child rent must be funded before the parent refund.
          </Notice>
        )}
        {error && <Notice error>{error}</Notice>}
        {check.error && <Notice error>{check.error}</Notice>}
        <button
          type="button"
          disabled={!canCheck}
          onClick={() => {
            if (!canCheck) return;
            void check.run(() =>
              checkBranch(
                client,
                parent,
                hashInput(payload),
                takeVote,
                wallet?.publicKey,
              ),
            );
          }}
        >
          {check.pending ? "Checking…" : "Check parent & preview — no fee"}
        </button>
        {check.value && (
          <div className="identity-box">
            <Identifier
              label="Resolved parent ID"
              value={check.value.parent.id}
            />
            <Identifier
              label="New branch canonical ID"
              value={check.value.id}
            />
            <Identifier
              label="New branch PDA"
              value={check.value.pda.toBase58()}
            />
            <p>
              Parent is live; destination is available. State is checked again
              before submission.
            </p>
          </div>
        )}
        <button className="primary" disabled={!canSubmit}>
          Create branch + first vote
        </button>
      </form>
    </section>
  );
}
