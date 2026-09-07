import { useEffect, useRef, useState } from "react";
import { errorMessage, hashFile } from "../workspace/values";

/** Shared local file hashing for new records and subsequent file versions. */
export function useFileDigest() {
  const [value, setDigest] = useState("");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const job = useRef<{ controller?: AbortController }>({});
  useEffect(() => {
    const pending = job.current;
    return () => pending.controller?.abort();
  }, []);

  const setValue = (next: string) => {
    job.current.controller?.abort();
    setDigest(next);
    setFileName("");
    setProgress(null);
    setError("");
  };
  const selectFile = async (file: File) => {
    job.current.controller?.abort();
    const controller = new AbortController();
    job.current.controller = controller;
    setDigest("");
    setFileName(file.name);
    setError("");
    setProgress(0);
    try {
      const digest = await hashFile(
        file,
        (percent) => {
          if (!controller.signal.aborted) setProgress(percent);
        },
        controller.signal,
      );
      if (!controller.signal.aborted) setDigest(digest);
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorMessage(caught));
    } finally {
      if (!controller.signal.aborted) setProgress(null);
    }
  };
  return {
    value,
    fileName,
    progress,
    error,
    hashing: progress !== null,
    setValue,
    selectFile,
  };
}
