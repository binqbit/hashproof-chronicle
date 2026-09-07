import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useNetwork } from "../contract/network";
import { errorMessage } from "../features/workspace/values";

/** Wallet Adapter owns remembered selection and trusted reconnect; no credentials are stored here. */
export function WalletControls() {
  const { wallet, connected, connecting, disconnecting, disconnect, select } =
    useWallet();
  const { busy } = useNetwork();
  const [error, setError] = useState("");
  const [forgetting, setForgetting] = useState(false);
  return (
    <div className="wallet-controls">
      <fieldset
        disabled={busy || disconnecting || forgetting}
        onClickCapture={(event) => {
          if (busy) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onKeyDownCapture={(event) => {
          if (busy) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <WalletMultiButton />
        {wallet && (
          <button
            type="button"
            disabled={connecting}
            onClick={async () => {
              setError("");
              setForgetting(true);
              try {
                await disconnect();
                select(null); // Forget the saved choice, including adapters that omit the disconnect event.
              } catch (caught) {
                setError(errorMessage(caught));
              } finally {
                setForgetting(false);
              }
            }}
          >
            {forgetting || disconnecting
              ? "Disconnecting…"
              : connected
                ? "Disconnect wallet"
                : "Forget wallet"}
          </button>
        )}
      </fieldset>
      {error && <small role="alert">{error}</small>}
    </div>
  );
}
