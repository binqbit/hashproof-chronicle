import { useEffect, useRef, useState } from "react";
import { PROGRAM_ID } from "../../contract/client";
import { errorMessage } from "../workspace/values";
import { readArchiveFiles } from "./archive-files";
import { buildProofGraph, type ProofGraph } from "./proof-graph";
import { changeProofSelection } from "./proof-selection";

interface ProofManagerSession {
  version: number;
  files: File[];
  graph: ProofGraph;
  included: ReadonlySet<string>;
  undo: ReadonlySet<string>[];
  inputNodes: number;
  convertedFiles: number;
}

/** File admission is atomic; selection changes never replace the graph/layout. */
export function useProofManager() {
  const [session, setSession] = useState<ProofManagerSession>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const job = useRef<AbortController>();
  useEffect(() => () => job.current?.abort(), []);

  const load = async (files: File[]) => {
    job.current?.abort();
    if (!files.length) {
      clear();
      return;
    }
    const controller = new AbortController();
    job.current = controller;
    setPending(true);
    setError("");
    try {
      const result = await readArchiveFiles(files, PROGRAM_ID.toBase58(), {
        signal: controller.signal,
      });
      const graph = buildProofGraph(result.archive);
      if (controller.signal.aborted) return;
      setSession((previous) => ({
        version: (previous?.version ?? 0) + 1,
        files,
        graph,
        // Missing graph placeholders are not previously imported records.
        included: new Set(
          Object.keys(graph.archive.nodes).filter(
            (pda) =>
              !previous?.graph.archive.nodes[pda] || previous.included.has(pda),
          ),
        ),
        undo: [],
        inputNodes: result.inputNodes,
        convertedFiles: result.convertedFiles,
      }));
    } catch (caught) {
      if (!controller.signal.aborted) setError(errorMessage(caught));
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  };
  const clear = () => {
    job.current?.abort();
    setSession(undefined);
    setError("");
    setPending(false);
  };
  const select = (records: Iterable<string>, include: boolean) => {
    if (pending) return;
    const ids = [...records];
    setSession((previous) => {
      if (!previous) return previous;
      const included = changeProofSelection(
        previous.included,
        ids.filter((pda) => !!previous.graph.archive.nodes[pda]),
        include,
      );
      if (included === previous.included) return previous;
      return {
        ...previous,
        included,
        undo: [...previous.undo.slice(-19), previous.included],
      };
    });
  };
  const undo = () => {
    if (pending) return;
    setSession((previous) =>
      !previous?.undo.length
        ? previous
        : {
            ...previous,
            included: previous.undo[previous.undo.length - 1],
            undo: previous.undo.slice(0, -1),
          },
    );
  };
  return {
    session,
    pending,
    error,
    clear,
    select,
    undo,
    addFiles: (files: File[]) => load([...(session?.files ?? []), ...files]),
    removeFile: (index: number) =>
      load(session?.files.filter((_, i) => i !== index) ?? []),
  };
}
