import React, { useState, useEffect } from 'react';
import { ExternalLink, Info, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useToast } from '@/hooks/use-toast';
import { hashToHex } from '@/lib/crypto';
import { deriveHashPda, deriveVotePda, PROGRAM_ID } from '@/lib/hashTimestamp';

interface OnChainInfoDialogProps {
  hash: Uint8Array;
  userHasVoted?: boolean;
}

export function OnChainInfoDialog({ hash, userHasVoted = false }: OnChainInfoDialogProps) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [network, setNetwork] = useState<string>('');
  const [explorerBase, setExplorerBase] = useState<string>('');

  useEffect(() => {
    const detectNetwork = async () => {
      try {
        const genesisHash = await connection.getGenesisHash();
        
        // Detect network based on genesis hash or endpoint
        const endpoint = connection.rpcEndpoint;
        
        if (endpoint.includes('devnet')) {
          setNetwork('devnet');
          setExplorerBase('https://explorer.solana.com');
        } else if (endpoint.includes('testnet')) {
          setNetwork('testnet');
          setExplorerBase('https://explorer.solana.com');
        } else if (endpoint.includes('mainnet')) {
          setNetwork('mainnet-beta');
          setExplorerBase('https://explorer.solana.com');
        } else {
          setNetwork('localnet');
          setExplorerBase('https://explorer.solana.com');
        }
      } catch (error) {
        console.error('Failed to detect network:', error);
        setNetwork('devnet');
        setExplorerBase('https://explorer.solana.com');
      }
    };

    detectNetwork();
  }, [connection]);

  const hashPda = deriveHashPda(PROGRAM_ID, hash);
  const votePda = publicKey ? deriveVotePda(PROGRAM_ID, hashPda, publicKey) : null;
  
  const getExplorerUrl = (address: string, type: 'account' | 'address' = 'account') => {
    const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
    return `${explorerBase}/${type}/${address}${cluster}`;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: `Failed to copy ${label}`,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Info className="h-4 w-4" />
          On-Chain Info
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 solana-gradient">
            <Info className="h-5 w-5" />
            On-Chain Information
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Network Info */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Network</label>
            <p className="text-sm font-mono bg-secondary/50 p-2 rounded mt-1 capitalize">
              {network || 'Detecting...'}
            </p>
          </div>


          {/* Hash Account PDA */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">Hash Account (PDA)</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-xs font-mono bg-secondary/50 p-2 rounded break-all">
                {hashPda.toBase58()}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(hashPda.toBase58(), 'Hash Account')}
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(getExplorerUrl(hashPda.toBase58()), '_blank')}
                className="shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Vote Account PDA (if user has voted) */}
          {userHasVoted && votePda && publicKey && (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Your Voter Account (PDA)</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-xs font-mono bg-secondary/50 p-2 rounded break-all">
                    {votePda.toBase58()}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(votePda.toBase58(), 'Vote Account')}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(getExplorerUrl(votePda.toBase58()), '_blank')}
                    className="shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Your Wallet Address</label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-xs font-mono bg-secondary/50 p-2 rounded break-all">
                    {publicKey.toBase58()}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(publicKey.toBase58(), 'Wallet Address')}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(getExplorerUrl(publicKey.toBase58(), 'address'), '_blank')}
                    className="shrink-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Program ID */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">HashTimestamp Program ID</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 text-xs font-mono bg-secondary/50 p-2 rounded break-all">
                {PROGRAM_ID.toBase58()}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(PROGRAM_ID.toBase58(), 'Program ID')}
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(getExplorerUrl(PROGRAM_ID.toBase58()), '_blank')}
                className="shrink-0"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-lg border border-primary/20">
            <p className="neon-text">
              <strong className="text-primary">On-Chain Verification:</strong> All accounts shown above exist on the Solana blockchain 
              and can be independently verified using Solana Explorer. The hash account stores the SHA-256 
              hash and metadata, while vote accounts track individual supporter deposits.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}