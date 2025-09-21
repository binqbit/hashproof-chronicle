import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, Target, Lightbulb, Code } from 'lucide-react';

interface InfoDialogProps {
  children: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

function InfoDialog({ children, title, content }: InfoDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold solana-gradient">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {content}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setOpen(false)} variant="default">
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HowItWorksDialog() {
  return (
    <InfoDialog 
      title="How Hash Timestamp Works"
      content={
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Hash Timestamp works by storing file hashes (fingerprints) on the Solana blockchain, 
            creating an immutable timestamp record that proves when a file existed.
          </p>
          
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold mb-2">📁 File Hashing</h4>
              <p className="text-sm text-muted-foreground">
                Your file is processed locally in your browser using SHA-256 to create a unique 32-byte hash. 
                The actual file never leaves your device, ensuring complete privacy.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">🗳️ Community Voting</h4>
              <p className="text-sm text-muted-foreground">
                Users can "vote" to support a hash by locking SOL tokens. Each vote acts as a security guard, 
                ensuring the timestamp stays preserved on the blockchain. The more votes, the more secure the record.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">🔒 Decentralized Storage</h4>
              <p className="text-sm text-muted-foreground">
                The timestamp isn't tied to any single user. As long as at least one person maintains their vote, 
                the record persists. If everyone withdraws, the storage is released, making it truly community-driven.
              </p>
            </div>
          </div>
          
          <div className="bg-muted/50 p-4 rounded-lg border border-primary/20">
            <p className="text-sm">
              <strong className="text-primary">Key Benefit:</strong> Multiple parties can collaborate to preserve important timestamps, 
              creating a shared responsibility model for digital record keeping.
            </p>
          </div>
        </div>
      }
    >
      <Button variant="outline" size="sm">
        <HelpCircle className="h-4 w-4 mr-2" />
        How It Works
      </Button>
    </InfoDialog>
  );
}

export function WhyNeededDialog() {
  return (
    <InfoDialog 
      title="Why Timestamp Verification is Needed"
      content={
        <div className="space-y-4">
          <p className="text-muted-foreground">
            In our digital world, proving when something was created is crucial for legal, business, 
            and personal purposes. Traditional timestamps can be manipulated, but blockchain technology 
            provides an immutable solution.
          </p>
          
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold mb-2">🛡️ Immutable Trust</h4>
              <p className="text-sm text-muted-foreground">
                Blockchain records cannot be altered or faked. Smart contracts execute exactly as programmed, 
                creating trustworthy timestamps that no single party can manipulate.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">⏰ Proof of Existence</h4>
              <p className="text-sm text-muted-foreground">
                By timestamping a file hash, you create verifiable proof that the document existed at a specific 
                moment in time, without revealing its contents to anyone.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">🤝 Collaborative Verification</h4>
              <p className="text-sm text-muted-foreground">
                Multiple interested parties can participate in preserving the timestamp, creating a distributed 
                system where no single entity controls the record's persistence.
              </p>
            </div>
          </div>
          
          <div className="bg-primary/10 p-4 rounded-lg border border-primary/25">
            <p className="text-sm">
              <strong className="text-primary">The Goal:</strong> Enable anyone to verify that a file existed at a specific time, 
              backed by the security and transparency of blockchain technology.
            </p>
          </div>
        </div>
      }
    >
      <Button variant="outline" size="sm">
        <Target className="h-4 w-4 mr-2" />
        Why It's Needed
      </Button>
    </InfoDialog>
  );
}

export function UseCasesDialog() {
  return (
    <InfoDialog 
      title="Real-World Use Cases"
      content={
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Hash Timestamp has numerous applications across various industries and use cases 
            where proving document authenticity and creation time is critical.
          </p>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">📋 Legal Documents</h4>
              <p className="text-sm text-muted-foreground">
                Contracts, agreements, or legal filings can be timestamped to prove they existed before 
                specific deadlines or events, providing legal protection and compliance verification.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">📸 Digital Evidence</h4>
              <p className="text-sm text-muted-foreground">
                Photos, videos, or recordings can be timestamped to prove they weren't created with 
                future AI tools or edited after an incident, maintaining their authenticity as evidence.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">💡 Intellectual Property</h4>
              <p className="text-sm text-muted-foreground">
                Inventors, artists, and creators can timestamp their work to establish prior art or 
                creation dates for patent applications, copyright claims, or licensing disputes.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">🏢 Corporate Compliance</h4>
              <p className="text-sm text-muted-foreground">
                Financial records, audit trails, and regulatory filings can be timestamped to meet 
                compliance requirements and provide transparent accountability.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">🔬 Research & Development</h4>
              <p className="text-sm text-muted-foreground">
                Scientific data, research findings, and experimental results can be timestamped to 
                establish discovery dates and maintain research integrity.
              </p>
            </div>
          </div>
          
          <div className="bg-accent/20 p-4 rounded-lg border border-accent/30">
            <p className="text-sm">
              <strong className="text-accent">Enhanced Security:</strong> When combined with digital signatures or other 
              authentication methods, timestamp verification provides comprehensive file integrity 
              and authenticity assurance over time.
            </p>
          </div>
        </div>
      }
    >
      <Button variant="outline" size="sm">
        <Lightbulb className="h-4 w-4 mr-2" />
        Use Cases
      </Button>
    </InfoDialog>
  );
}

export function DeveloperResourcesDialog() {
  return (
    <InfoDialog 
      title="Developer Resources"
      content={
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Want to integrate hash timestamping into your own application? Use our open-source smart contract
            to implement the same functionality on your website or API.
          </p>
          
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold mb-2">🔗 Smart Contract Integration</h4>
              <p className="text-sm text-muted-foreground">
                Our Hash Timestamp service is powered by a Solana smart contract that you can integrate 
                into your own applications. Perfect for adding document verification to existing systems.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">📖 Documentation & Examples</h4>
              <p className="text-sm text-muted-foreground">
                The GitHub repository includes complete documentation, code examples, and integration guides 
                to help you implement hash timestamping in your projects.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">🛠️ API Development</h4>
              <p className="text-sm text-muted-foreground">
                Build your own APIs for document verification, download systems with hash validation, 
                or any application that needs blockchain-based timestamp proof.
              </p>
            </div>
          </div>
          
          <div className="bg-primary/10 p-4 rounded-lg border border-primary/25">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-primary mb-1">Hash Timestamp Smart Contract</p>
                <p className="text-sm text-muted-foreground">
                  Open source Solana program for hash timestamping
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open('https://github.com/binqbit/hash-timestamp', '_blank')}
                className="shrink-0"
              >
                View on GitHub
              </Button>
            </div>
          </div>
        </div>
      }
    >
      <Button variant="outline" size="sm">
        <Code className="h-4 w-4 mr-2" />
        Developers
      </Button>
    </InfoDialog>
  );
}

export function InfoButtons() {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <HowItWorksDialog />
      <WhyNeededDialog />
      <UseCasesDialog />
      <DeveloperResourcesDialog />
    </div>
  );
}