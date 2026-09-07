import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useNetwork } from "../contract/network";

/** Wallet Adapter owns remembered selection and trusted reconnect; no credentials are stored here. */
export function WalletControls() {
  const { disconnecting } = useWallet();
  const { busy } = useNetwork();
  const locked = busy || disconnecting;
  return (
    <div className="wallet-controls">
      <fieldset
        disabled={locked}
        onClickCapture={(event) => {
          if (locked) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onKeyDownCapture={(event) => {
          if (locked) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <WalletMultiButton />
      </fieldset>
    </div>
  );
}
