import React, { useState, useCallback } from 'react';
import { Upload, File, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { hashFile, hashToHex } from '@/lib/crypto';
import { useToast } from '@/hooks/use-toast';

interface FileUploadProps {
  onHashGenerated: (hash: Uint8Array, fileName: string) => void;
}

export function FileUpload({ onHashGenerated }: FileUploadProps) {
  const [isHashing, setIsHashing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;

    setIsHashing(true);
    try {
      const hash = await hashFile(file);
      onHashGenerated(hash, file.name);
      toast({
        title: "File hashed successfully",
        description: `Generated hash for ${file.name}`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Hashing failed",
        description: "Failed to generate file hash. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsHashing(false);
    }
  }, [onHashGenerated, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <Card className="gradient-card shadow-card neon-card-subtle">
      <CardContent className="p-6">
        <div 
          className={`file-upload-area ${dragOver ? 'drag-over' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          <div className="flex flex-col items-center gap-4">
            {isHashing ? (
              <>
                <Hash className="h-12 w-12 text-primary animate-spin" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Generating Hash</h3>
                  <p className="text-muted-foreground">Computing SHA-256 fingerprint...</p>
                </div>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 text-primary" />
                <div className="text-center">
                  <h3 className="text-lg font-semibold">Upload File to Timestamp</h3>
                  <p className="text-muted-foreground mb-4">
                    Files are hashed locally - they never leave your device
                  </p>
                  <input
                    type="file"
                    id="file-input"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => document.getElementById('file-input')?.click()}
                    disabled={isHashing}
                  >
                    <File className="h-4 w-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              </>
            )}
          </div>
          <div className="mt-4 text-xs text-muted-foreground text-center">
            Drag and drop a file here, or click to select
          </div>
        </div>
      </CardContent>
    </Card>
  );
}