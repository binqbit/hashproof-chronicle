import { Field, Notice } from "../workspace/fields";
import { FilePicker } from "../workspace/FilePicker";
import type { useFileDigest } from "./use-file-digest";

export function FileDigestFields({
  digest,
  fileLabel,
  inputLabel,
  prompt,
  disabled = false,
}: {
  digest: ReturnType<typeof useFileDigest>;
  fileLabel: string;
  inputLabel: string;
  prompt: string;
  disabled?: boolean;
}) {
  return (
    <>
      <FilePicker
        label={fileLabel}
        prompt={prompt}
        hint="File contents never leave your browser. Or paste a digest below."
        fileName={digest.fileName}
        disabled={disabled || digest.hashing}
        onSelect={(file) => void digest.selectFile(file)}
      />
      {digest.hashing && (
        <div className="actions">
          <p role="status">Hashing: {digest.progress}%</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => digest.setValue("")}
          >
            Cancel hashing
          </button>
        </div>
      )}
      <Field
        label={inputLabel}
        hint="32-byte hash in hex (64 characters, without 0x) or Base58. Files fill this field with hex automatically."
      >
        {(id) => (
          <input
            id={id}
            className="mono"
            value={digest.value}
            onChange={(event) => digest.setValue(event.target.value)}
            disabled={disabled || digest.hashing}
            spellCheck={false}
          />
        )}
      </Field>
      {digest.error && <Notice error>{digest.error}</Notice>}
    </>
  );
}
