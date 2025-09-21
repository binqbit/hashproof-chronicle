import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, AlertCircle } from 'lucide-react';

export function WalletConnection() {
  const { connected, publicKey } = useWallet();

  return (
    <Card className="gradient-card shadow-card neon-card-subtle">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold solana-gradient">Solana Wallet</h3>
              {connected ? (
                <p className="text-sm text-muted-foreground">
                  <span className="text-primary font-mono neon-text">{publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}</span>
                </p>
              ) : (
                <p className="text-sm neon-text">
                  Connect a wallet on Solana to continue
                </p>
              )}
            </div>
          </div>
          <WalletMultiButton className="gradient-primary hover:opacity-90 !h-12 shadow-neon !border-2 !border-primary/60 hover:!border-primary/80 hover:!shadow-xl transition-all duration-300 !font-semibold !px-8 !rounded-lg glow-primary neon-card-subtle" />
        </div>
        
        {!connected && (
          <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-secondary/30 p-3 rounded">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium neon-text">Wallet Required for Full Features</p>
              <p>Connect a Solana wallet to vote for timestamps, which locks a small SOL deposit to keep records active.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}