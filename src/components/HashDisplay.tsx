import React, { useState, useEffect } from 'react';
import { Copy, Clock, Users, Shield, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { hashToHex, formatTimestamp, formatSOL } from '@/lib/crypto';
import { useToast } from '@/hooks/use-toast';
import { OnChainInfoDialog } from './OnChainInfoDialog';

interface HashInfo {
  hash: Uint8Array;
  voters: number;
  createdAt: number;
  fileName?: string;
}

interface HashDisplayProps {
  hashInfo: HashInfo;
  rentAmount?: number;
  userHasVoted?: boolean;
  onVote?: () => void;
  onUnvote?: () => void;
  onVerify?: () => void;
  isLoading?: boolean;
}

export function HashDisplay({ 
  hashInfo, 
  rentAmount,
  userHasVoted = false,
  onVote,
  onUnvote, 
  onVerify,
  isLoading = false
}: HashDisplayProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const hexHash = hashToHex(hashInfo.hash);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(hexHash);
      setCopied(true);
      toast({
        title: "Hash copied",
        description: "File hash copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy hash to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="gradient-card shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          File Timestamp Record
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Info */}
        {hashInfo.fileName && (
          <div>
            <label className="text-sm font-medium text-muted-foreground">File</label>
            <p className="text-sm font-mono">{hashInfo.fileName}</p>
          </div>
        )}

        {/* Hash */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">SHA-256 Hash</label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 text-xs font-mono bg-secondary/50 p-2 rounded break-all">
              {hexHash}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyToClipboard}
              className="shrink-0"
            >
              <Copy className={`h-4 w-4 ${copied ? 'text-success' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Timestamp Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Timestamped
            </label>
            <p className="text-sm">{formatTimestamp(hashInfo.createdAt)}</p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-4 w-4" />
              Supporters
            </label>
            <div className="flex items-center gap-2">
              <Badge variant={hashInfo.voters > 0 ? "default" : "secondary"}>
                {hashInfo.voters}
              </Badge>
              {userHasVoted && (
                <Badge variant="outline" className="text-success border-success">
                  You voted
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {onVerify && (
            <Button 
              variant="outline" 
              onClick={onVerify}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Verify (Free)
            </Button>
          )}
          
          <OnChainInfoDialog 
            hash={hashInfo.hash} 
            userHasVoted={userHasVoted} 
          />
          
          {onVote && !userHasVoted && (
            <Button 
              variant="gradient"
              onClick={onVote}
              disabled={isLoading}
            >
              Vote & Support ({rentAmount ? formatSOL(rentAmount) : '...'} SOL)
            </Button>
          )}
          
          {onUnvote && userHasVoted && (
            <Button 
              variant="destructive"
              onClick={onUnvote}
              disabled={isLoading}
            >
              Withdraw Vote
            </Button>
          )}
        </div>

        {/* Info Message */}
        <div className="text-xs text-muted-foreground bg-secondary/30 p-3 rounded">
          <p>
            <strong>How it works:</strong> Voting locks SOL to keep this timestamp active on Solana. 
            The deposit is fully refundable when you withdraw your vote.
            {hashInfo.voters === 1 && userHasVoted && (
              <span className="text-warning"> You're the only supporter - withdrawing will erase this timestamp.</span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}