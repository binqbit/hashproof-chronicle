import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function NavbarWallet() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="flex items-center gap-4">
      {connected && publicKey && (
        <div className="hidden sm:block text-sm neon-text font-mono">
          {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-4)}
        </div>
      )}
      <WalletMultiButton className="gradient-primary hover:opacity-90 !h-10 !text-sm !px-6 shadow-neon !border-2 !border-primary/60 hover:!border-primary/80 transition-all duration-300 !rounded-lg glow-primary !font-semibold neon-card-subtle" />
    </div>
  );
}