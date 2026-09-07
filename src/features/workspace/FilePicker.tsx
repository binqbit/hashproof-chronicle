import { useId } from "react";
import { FileCheck2, FileUp } from "lucide-react";

type FilePickerProps = {
  label: string;
  prompt: string;
  hint: string;
  fileName?: string;
  accept?: string;
  disabled?: boolean;
} & (
  | { multiple?: false; onSelect(file: File): void }
  | { multiple: true; onSelect(files: File[]): void }
);

/** A native file input underneath a shared, keyboard-accessible selection card. */
export function FilePicker(props: FilePickerProps) {
  const {
    label,
    prompt,
    hint,
    fileName = "",
    accept,
    disabled = false,
  } = props;
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
        {props.multiple
          ? fileName
            ? "Add files"
            : "Choose files"
          : fileName
          ? "Choose another file"
          : "Choose file"}
      </span>
      <input
        aria-label={label}
        aria-describedby={hintId}
        type="file"
        accept={accept}
        multiple={props.multiple}
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Reset the native selection so choosing the same file still emits change.
          event.target.value = "";
          if (!files.length) return;
          if (props.multiple) props.onSelect(files);
          else props.onSelect(files[0]);
        }}
      />
    </label>
  );
}
