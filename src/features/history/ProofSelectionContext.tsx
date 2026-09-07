import { createContext, useContext } from "react";
import type { ProofGraph } from "./proof-graph";

export interface ProofSelectionInteraction {
  graph: ProofGraph;
  included: ReadonlySet<string>;
  preview?: ReadonlySet<string>;
  disabled: boolean;
  onSelect(records: Iterable<string>, include: boolean): void;
  onPreview(records?: ReadonlySet<string>): void;
}

export const ProofSelectionContext = createContext<
  ProofSelectionInteraction | undefined
>(undefined);
export const useProofSelection = () => useContext(ProofSelectionContext);
