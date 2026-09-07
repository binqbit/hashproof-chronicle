import { useId } from "react";
import { FileCheck2, FileUp } from "lucide-react";

/** A native file input underneath a shared, keyboard-accessible selection card. */
export function FilePicker({
  label,
  prompt,
  hint,
  fileName = "",
  accept,
  disabled = false,
  onSelect,
}: {
  label: string;
  prompt: string;
  hint: string;
  fileName?: string;
  accept?: string;
  disabled?: boolean;
  onSelect(file: File): void;
}) {
  const hintId = useId();
  const Icon = fileName ? FileCheck2 : FileUp;
  return (
    <label className="file-drop" data-disabled={disabled}>
      <span className="file-picker-icon">
        <Icon aria-hidden="true" />
      </span>
      <strong>{fileName || prompt}</strong>
      <span id={hintId}>{hint}</span>
      <span className="file-picker-action">
        {fileName ? "Choose another file" : "Choose file"}
      </span>
      <input
        aria-label={label}
        aria-describedby={hintId}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset the native selection so choosing the same file still emits change.
          event.target.value = "";
          if (file) onSelect(file);
        }}
      />
    </label>
  );
}
