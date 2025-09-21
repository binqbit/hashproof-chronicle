import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { HashDisplay } from '@/components/HashDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface HashInfo {
  hash: Uint8Array;
  voters: number;
  createdAt: number;
  fileName?: string;
}

export default function HashDetail() {
  const { hash } = useParams<{ hash: string }>();
  const { toast } = useToast();
  const [hashInfo, setHashInfo] = useState<HashInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hash) {
      setError('No hash provided in URL');
      setLoading(false);
      return;
    }

    // Validate hash format (should be 64 hex characters for SHA-256)
    if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
      setError('Invalid hash format. Expected 64 hexadecimal characters.');
      setLoading(false);
      return;
    }

    // Convert hex hash back to Uint8Array
    try {
      const hashBytes = new Uint8Array(hash.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      
      // For now, create mock data since we don't have a lookup service yet
      // In a real app, this would fetch from your backend/blockchain
      setHashInfo({
        hash: hashBytes,
        voters: 0,
        createdAt: Date.now(),
        fileName: 'File linked to hash'
      });
      setLoading(false);
    } catch (err) {
      setError('Failed to parse hash');
      setLoading(false);
    }
  }, [hash]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-secondary rounded w-48 mb-6"></div>
              <div className="h-64 bg-secondary rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !hashInfo) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <Link to="/">
              <Button variant="ghost" className="mb-6">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            
            <Card className="border-destructive">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 text-destructive">
                  <AlertCircle className="h-6 w-6" />
                  <div>
                    <h2 className="text-lg font-semibold">Hash Not Found</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {error || 'The requested hash could not be found.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link to="/">
            <Button variant="ghost" className="mb-6">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          
          <HashDisplay 
            hashInfo={hashInfo}
            onVerify={() => {
              toast({
                title: "Verification complete",
                description: "Hash verified successfully",
                variant: "default",
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}