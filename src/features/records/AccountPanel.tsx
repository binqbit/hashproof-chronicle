import { useState } from "react";
import type { OperationProps as Props } from "../workspace/operation-types";
import * as operations from "../workspace/operations";
import { accountPublicKey } from "../../contract/sdk";
import { Field, Notice } from "../workspace/fields";
import { errorMessage } from "../workspace/values";

export function AccountPanel({ disabled, run }: Props) {
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="panel">
      <h2>Commit an account snapshot</h2>
      <p>
        Hash a Solana account's address, owner, balance, executable flag, rent
        epoch and data. This does not timestamp a local file.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          try {
            const address = accountPublicKey(target.trim());
            void run("Commit account snapshot", (client) =>
              operations.accountSnapshot(client, address),
            );
          } catch (caught) {
            setError(errorMessage(caught));
          }
        }}
      >
        <Field
          label="Target Solana account address"
          hint="Public key in Base58 or 64-character hex. Addresses are displayed in Base58."
        >
          {(id) => (
            <input
              id={id}
              className="mono"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              required
              disabled={disabled}
            />
          )}
        </Field>
        <Notice>
          Retain the exported snapshot. The contract stores a commitment, not
          the account data. A changing target may make the transaction or proof
          capture fail.
        </Notice>
        {error && <Notice error>{error}</Notice>}
        <button className="primary" disabled={disabled}>
          Commit snapshot + first vote
        </button>
      </form>
    </section>
  );
}
