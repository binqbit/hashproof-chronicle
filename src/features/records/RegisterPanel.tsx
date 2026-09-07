import { FormEvent, useMemo, useState } from "react";
import { Fingerprint } from "lucide-react";
import { deriveGenesisHashId } from "../../contract/sdk";
import { PROGRAM_ID } from "../../contract/client";
import { deriveHashPda } from "../../contract/sdk";
import { Identifier, Notice } from "../workspace/fields";
import { errorMessage, hashInput, hex } from "../workspace/values";
import { useNetwork } from "../../contract/network";
import { useFileDigest } from "./use-file-digest";
import { FileDigestFields } from "./FileDigestFields";

export function RegisterPanel({
  disabled,
  onRegister,
  onInspect,
}: {
  disabled: boolean;
  onRegister(hash: Uint8Array): void;
  onInspect(id: string): void;
}) {
  const digest = useFileDigest();
  const raw = digest.value;
  const { busy } = useNetwork();
  const [error, setError] = useState("");
  const identity = useMemo(() => {
    try {
      const id = deriveGenesisHashId(hashInput(raw));
      return { id: hex(id), pda: deriveHashPda(PROGRAM_ID, id).toBase58() };
    } catch {
      return null;
    }
  }, [raw]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled || digest.hashing || !identity) return;
    setError("");
    try {
      onRegister(hashInput(raw));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };
  return (
    <section className="panel">
      <div className="section-heading">
        <Fingerprint />
        <div>
          <h2>Timestamp a file</h2>
          <p>Hash locally. Register only a 32-byte commitment.</p>
        </div>
      </div>
      <form onSubmit={submit}>
        <FileDigestFields
          digest={digest}
          fileLabel="File to timestamp"
          inputLabel="Raw SHA-256 / 32-byte value"
          prompt="Choose a file to hash"
          disabled={busy}
        />
        {identity && (
          <div className="identity-box">
            <Identifier
              label="Canonical ID (Hash source)"
              value={identity.id}
            />
            <Identifier label="Hash account PDA" value={identity.pda} />
          </div>
        )}
        {error && <Notice error>{error}</Notice>}
        <div className="actions">
          <button
            className="primary"
            disabled={disabled || !identity || digest.hashing}
          >
            Register + first vote
          </button>
          <button
            type="button"
            disabled={!identity || digest.hashing}
            onClick={() => identity && onInspect(identity.id)}
          >
            Inspect record — no fee
          </button>
        </div>
      </form>
      <p className="fine-print">
        Registration creates your first vote and requires rent plus transaction
        fees. If the record already exists, inspect it and add a vote instead.
      </p>
    </section>
  );
}
