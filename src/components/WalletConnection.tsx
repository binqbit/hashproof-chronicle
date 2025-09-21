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
                <p className="text-sm text-muted-foreground">
                  Connect to vote and support timestamps
                </p>
              )}
            </div>
          </div>
          <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !h-10 shadow-neon !border !border-primary/50 hover:!shadow-xl transition-all duration-300 !flex !items-center !gap-2 !font-semibold">
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="!inline"
            >
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/>
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2"/>
            </svg>
          </WalletMultiButton>
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