import { useMemo, useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createReadClient,
  createSigningClient,
  PROGRAM_ID,
} from "../../contract/client";
import { useNetwork } from "../../contract/network";
import type { HashTimestampClient } from "../../contract/sdk";
import {
  ArchiveCaptureError,
  canonicalHashId,
  decodeHashSource,
} from "../../contract/sdk";
import type { Receipt } from "./operations";
import { errorMessage, hex } from "./values";

export function useContract() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { network } = useNetwork();
  const client = useMemo(() => createReadClient(connection), [connection]);
  const availability = useQuery({
    queryKey: ["program", network.endpoint, PROGRAM_ID.toBase58()],
    queryFn: async () =>
      Boolean((await connection.getAccountInfo(PROGRAM_ID))?.executable),
    refetchInterval: 15_000,
  });
  return { client, connection, wallet, availability };
}

export function useTransaction(onSuccess: (receipt: Receipt) => void) {
  const { connection, wallet } = useContract();
  const { network, acquire, release } = useNetwork();
  const queries = useQueryClient();
  const [error, setError] = useState("");
  const [pendingLabel, setPendingLabel] = useState("");
  const run = async (
    label: string,
    operation: (client: HashTimestampClient) => Promise<Receipt>
  ) => {
    setError("");
    if (!wallet) {
      setError("Connect a wallet that supports signing first.");
      return;
    }
    if (!acquire()) return;
    setPendingLabel(label);
    try {
      if (!(await connection.getAccountInfo(PROGRAM_ID))?.executable)
        throw new Error(
          `The configured program is not deployed on ${network.label}.`
        );
      const receipt = await operation(createSigningClient(connection, wallet));
      onSuccess(receipt);
      void queries.invalidateQueries({
        predicate: (query) => query.queryKey.includes(network.endpoint),
      });
    } catch (caught) {
      if (
        caught instanceof ArchiveCaptureError &&
        caught.status === "confirmed"
      ) {
        onSuccess({
          signature: caught.signature,
          ids: [
            hex(
              canonicalHashId(
                caught.pendingNode.hash,
                decodeHashSource(caught.pendingNode.source)
              )
            ),
          ],
          warning: `Transaction confirmed, but archive capture failed. Do not repeat creation. ${errorMessage(
            caught.cause
          )}`,
        });
        void queries.invalidateQueries({
          predicate: (query) => query.queryKey.includes(network.endpoint),
        });
        return;
      }
      setError(
        `${errorMessage(
          caught
        )} If confirmation timed out, check the wallet/explorer before retrying; the transaction may have landed.`
      );
    } finally {
      setPendingLabel("");
      release();
    }
  };
  return { run, error, pendingLabel };
}
