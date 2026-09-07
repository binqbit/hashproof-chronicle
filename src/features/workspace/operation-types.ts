import type {
  HashTimestampClient,
  RestoreProofInput,
} from "../../contract/sdk";
import type { Receipt } from "./operations";

export interface OperationProps {
  disabled: boolean;
  selected: string;
  history: RestoreProofInput[];
  run(
    label: string,
    action: (client: HashTimestampClient) => Promise<Receipt>,
  ): Promise<void>;
}
