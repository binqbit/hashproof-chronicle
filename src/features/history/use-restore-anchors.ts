import { useEffect, useState } from "react";
import type { HashArchive, HashTimestampClient } from "../../contract/sdk";
import { errorMessage } from "../workspace/values";
import { readRestoreAnchors, type RestoreRecordState } from "./restore-anchors";

/** A file/network-scoped snapshot. Selection changes must not erase live records. */
export function useRestoreAnchors(
  client: HashTimestampClient,
  archive: HashArchive | undefined,
  revision: number,
) {
  const [state, setState] = useState<{
    client: HashTimestampClient;
    archive: HashArchive;
    revision: number;
    pending: boolean;
    records?: ReadonlyMap<string, RestoreRecordState>;
    error?: string;
  }>();
  useEffect(() => {
    if (!archive) return;
    const controller = new AbortController();
    const identity = { client, archive, revision };
    setState({ ...identity, pending: true });
    void readRestoreAnchors(client, archive, controller.signal).then(
      (records) => {
        if (!controller.signal.aborted)
          setState({ ...identity, pending: false, records });
      },
      (error) => {
        if (!controller.signal.aborted)
          setState({ ...identity, pending: false, error: errorMessage(error) });
      },
    );
    return () => controller.abort();
  }, [client, archive, revision]);
  return state?.client === client &&
    state.archive === archive &&
    state.revision === revision
    ? state
    : { pending: Boolean(archive), records: undefined, error: undefined };
}
