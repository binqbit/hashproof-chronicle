import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileUpload } from './FileUpload';
import { HashDisplay } from './HashDisplay';
import { WalletConnection } from './WalletConnection';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Search, Clock } from 'lucide-react';
import { HashTimestampClient, rentExemptForHash, HashAccount, VoteInfo } from '@/lib/hashTimestamp';
import { createProgram } from '@/lib/anchorSetup';
import { hexToHash, hashToHex } from '@/lib/crypto';
import { useToast } from '@/hooks/use-toast';
import cryptoBg from '@/assets/crypto-security-bg.jpg';
import { Navigation } from './Navigation';

export function FileTimestamp() {
  const { hash: urlHash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  const { connection } = useConnection();
  const { publicKey, connected, wallet, signTransaction, signAllTransactions } = useWallet();
  const { toast } = useToast();
  
  const [client, setClient] = useState<HashTimestampClient | null>(null);
  const [currentHash, setCurrentHash] = useState<Uint8Array | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [hashAccount, setHashAccount] = useState<HashAccount | null>(null);
  const [voteInfo, setVoteInfo] = useState<VoteInfo | null>(null);
  const [rentAmount, setRentAmount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHash, setSearchHash] = useState('');

  // Initialize client when wallet connects
  useEffect(() => {
    if (connected && publicKey && signTransaction && signAllTransactions) {
      try {
        // Create wallet object that anchor can use
        const anchorWallet = {
          publicKey,
          signTransaction,
          signAllTransactions,
        };
        
        const program = createProgram(connection, anchorWallet);
        setClient(new HashTimestampClient(program));
      } catch (error) {
        console.error('Failed to initialize HashTimestamp client:', error);
        toast({
          title: "Initialization failed",
          description: "Failed to connect to HashTimestamp program",
          variant: "destructive",
        });
      }
    } else {
      setClient(null);
    }
  }, [connected, publicKey, signTransaction, signAllTransactions, connection, toast]);

  // Load rent amount on connection
  useEffect(() => {
    rentExemptForHash(connection).then(setRentAmount);
  }, [connection]);

  // Handle URL hash parameter
  useEffect(() => {
    if (urlHash && urlHash.length === 64) {
      try {
        const hash = hexToHash(urlHash);
        setCurrentHash(hash);
        setCurrentFileName(null);
      } catch (error) {
        console.error('Invalid hash in URL:', error);
        navigate('/');
      }
    }
  }, [urlHash, navigate]);

  // Sync URL when current hash changes
  useEffect(() => {
    if (currentHash) {
      const hexHash = hashToHex(currentHash);
      if (window.location.pathname !== `/hash/${hexHash}`) {
        navigate(`/hash/${hexHash}`, { replace: true });
      }
    } else if (window.location.pathname !== '/') {
      navigate('/', { replace: true });
    }
  }, [currentHash, navigate]);

  // Load hash account when hash changes
  useEffect(() => {
    const activeClient = client;

    if (!currentHash || !activeClient) {
      setHashAccount(null);
      setVoteInfo(null);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const loadHashAccount = async () => {
      setIsLoading(true);
      setHashAccount(null);
      setVoteInfo(null);

      try {
        const account = await activeClient.fetchHashAccount(currentHash);
        if (isCancelled) {
          return;
        }

        setHashAccount(account as HashAccount | null);

        if (account && publicKey) {
          const vote = await activeClient.fetchVoteInfo(currentHash, publicKey);
          if (!isCancelled) {
            setVoteInfo(vote as VoteInfo | null);
          }
        } else if (!isCancelled) {
          setVoteInfo(null);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error('Failed to load hash account:', error);
          setHashAccount(null);
          setVoteInfo(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadHashAccount();

    return () => {
      isCancelled = true;
    };
  }, [currentHash, publicKey, client]);

  const handleHashGenerated = (hash: Uint8Array, fileName: string) => {
    setHashAccount(null);
    setVoteInfo(null);
    setCurrentHash(hash);
    setCurrentFileName(fileName);
  };

  const handleSearchHash = () => {
    if (searchHash.length !== 64) {
      toast({
        title: "Invalid hash",
        description: "Hash must be exactly 64 hexadecimal characters",
        variant: "destructive",
      });
      return;
    }

    try {
      const hash = hexToHash(searchHash);
      setHashAccount(null);
      setVoteInfo(null);
      setCurrentHash(hash);
      setCurrentFileName(null);
    } catch (error) {
      toast({
        title: "Invalid hash format",
        description: "Please enter a valid hexadecimal hash",
        variant: "destructive",
      });
    }
  };

  const handleVote = async () => {
    if (!currentHash || !connected || !client) return;
    
    setIsLoading(true);
    try {
      const signature = await client.vote(currentHash);
      toast({
        title: "Vote submitted",
        description: `Transaction: ${signature.slice(0, 8)}...`,
      });
      
      // Reload account data
      const account = await client.fetchHashAccount(currentHash);
      setHashAccount(account as HashAccount | null);
      if (publicKey) {
        const vote = await client.fetchVoteInfo(currentHash, publicKey);
        setVoteInfo(vote as VoteInfo | null);
      }
    } catch (error: any) {
      console.error('Vote failed:', error);
      toast({
        title: "Vote failed",
        description: error.message || "Failed to submit vote transaction",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnvote = async () => {
    if (!currentHash || !connected || !client) return;
    
    setIsLoading(true);
    try {
      const signature = await client.unvote(currentHash);
      toast({
        title: "Vote withdrawn",
        description: `Transaction: ${signature.slice(0, 8)}...`,
      });
      
      // Reload account data
      const account = await client.fetchHashAccount(currentHash);
      setHashAccount(account as HashAccount | null);
      setVoteInfo(null);
    } catch (error: any) {
      console.error('Unvote failed:', error);
      toast({
        title: "Unvote failed",
        description: error.message || "Failed to withdraw vote",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!currentHash || !client) return;
    
    setIsLoading(true);
    try {
      await client.verify(currentHash);
      toast({
        title: "Verification complete",
        description: hashAccount ? "Hash exists on-chain" : "Hash not found on-chain",
        variant: hashAccount ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error('Verification failed:', error);
      toast({
        title: "Verification failed",
        description: error.message || "Failed to verify hash on-chain",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Navigation */}
      <Navigation />
      
      {/* Main content with top padding to account for fixed navbar */}
      <div className="pt-20">
        {/* Crypto Security Background */}
        <div className="pointer-events-none fixed inset-0 z-0">
        <img 
          src={cryptoBg} 
          alt="Cryptographic security and hashing visualization"
          className="w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/30 via-background/60 to-background/80"></div>
        
        {/* Additional subtle overlay patterns */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-primary/5 to-transparent"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.1),transparent_50%)]"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_70%_20%,hsl(var(--accent)/0.1),transparent_50%)]"></div>
        </div>
      </div>
      
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-4xl">
        {/* Compact Description */}
        <div className="text-center mb-8">
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Prove your file existed at a specific moment in time using Solana blockchain.
            <br />
            <span className="text-primary font-medium">Files are hashed locally - they never leave your device.</span>
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column - Upload and Search */}
          <div className="space-y-6">
            {/* File Upload */}
            <FileUpload onHashGenerated={handleHashGenerated} />

            {/* Hash Search */}
            <Card className="gradient-card shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  Lookup Existing Hash
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="hash-search">SHA-256 Hash (64 characters)</Label>
                  <Input
                    id="hash-search"
                    placeholder="Enter file hash to lookup timestamp..."
                    value={searchHash}
                    onChange={(e) => setSearchHash(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <Button 
                  variant="gradient"
                  onClick={handleSearchHash}
                  disabled={searchHash.length !== 64}
                  className="w-full"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search Timestamp
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Hash Display */}
          <div>
            {currentHash ? (
              <HashDisplay
                hashInfo={{
                  hash: currentHash,
                  voters: Number(hashAccount?.voters || 0),
                  createdAt: Number(hashAccount?.createdAt || Date.now() / 1000),
                  fileName: currentFileName || undefined,
                }}
                rentAmount={rentAmount || undefined}
                userHasVoted={!!voteInfo}
                onVote={connected ? handleVote : undefined}
                onUnvote={connected && voteInfo ? handleUnvote : undefined}
                onVerify={handleVerify}
                isLoading={isLoading}
              />
            ) : (
              <Card className="gradient-card shadow-card h-full flex items-center justify-center">
                <CardContent className="text-center p-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No File Selected</h3>
                  <p className="text-muted-foreground">
                    Upload a file or search for an existing hash to view timestamp information
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* How It Works */}
        <Card className="mt-8 gradient-card shadow-card">
          <CardHeader>
            <CardTitle>How File Timestamp Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-2 font-bold">
                  1
                </div>
                <h4 className="font-semibold mb-1">Hash Locally</h4>
                <p className="text-sm text-muted-foreground">Files are hashed using SHA-256 in your browser</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-2 font-bold">
                  2
                </div>
                <h4 className="font-semibold mb-1">Vote & Timestamp</h4>
                <p className="text-sm text-muted-foreground">Lock SOL to timestamp the hash on Solana blockchain</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-2 font-bold">
                  3
                </div>
                <h4 className="font-semibold mb-1">Prove & Verify</h4>
                <p className="text-sm text-muted-foreground">Anyone can verify the timestamp exists on-chain</p>
              </div>
            </div>
            <Separator />
            <div className="text-sm text-muted-foreground">
              <strong>Privacy:</strong> Only the file hash is stored on-chain, never the file contents. 
              Your files remain completely private on your device.
            </div>
          </CardContent>
        </Card>
        </div> {/* Close content wrapper div */}
      </div>
    </div>
  );
}

