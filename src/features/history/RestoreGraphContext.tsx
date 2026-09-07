import { createContext, useContext } from "react";
import type { RestoreRecordState } from "./restore-anchors";

export interface RestoreGraphInteraction {
  selected: ReadonlySet<string>;
  anchors: ReadonlySet<string>;
  proofNodes: ReadonlySet<string>;
  proofEdges: ReadonlySet<string>;
  required: ReadonlySet<string>;
  present: ReadonlySet<string>;
  records?: ReadonlyMap<string, RestoreRecordState>;
  disabled: boolean;
  onToggle(pda: string): void;
}

export const RestoreGraphContext = createContext<
  RestoreGraphInteraction | undefined
>(undefined);
export const useRestoreGraph = () => useContext(RestoreGraphContext);
