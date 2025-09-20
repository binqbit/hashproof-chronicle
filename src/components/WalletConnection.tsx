import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Card, CardContent } from '@/components/ui/card';
import { Wallet, AlertCircle } from 'lucide-react';

export function WalletConnection() {
  const { connected, publicKey } = useWallet();

  return (
    <Card className="gradient-card shadow-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Solana Wallet</h3>
              {connected ? (
                <p className="text-sm text-muted-foreground">
                  {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-8)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Connect to vote and support timestamps
                </p>
              )}
            </div>
          </div>
          <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !h-10" />
        </div>
        
        {!connected && (
          <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-secondary/30 p-3 rounded">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Wallet Required for Full Features</p>
              <p>Connect a Solana wallet to vote for timestamps, which locks a small SOL deposit to keep records active.</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}