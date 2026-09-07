import { ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { NetworkProvider, useNetwork } from "../contract/network";
import "@solana/wallet-adapter-react-ui/styles.css";

function WalletBoundary({ children }: { children: ReactNode }) {
  const { network } = useNetwork();
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  return (
    <ConnectionProvider
      endpoint={network.endpoint}
      config={{ commitment: "confirmed" }}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function AppWalletProvider({ children }: { children: ReactNode }) {
  return (
    <NetworkProvider>
      <WalletBoundary>{children}</WalletBoundary>
    </NetworkProvider>
  );
}
