import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function NavbarWallet() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="flex items-center gap-4">
      {connected && publicKey && (
        <div className="hidden sm:block text-sm text-muted-foreground">
          {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
        </div>
      )}
      <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !h-9 !text-sm !px-4" />
    </div>
  );
}