import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { NavbarWallet } from './NavbarWallet';
import { InfoButtons } from './InfoDialogs';

export function Navigation() {
  return (
    <nav className="bg-background/95 backdrop-blur-sm border-b border-border/40 sticky top-0 z-50 nav-glow">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Left side - Title and Info Buttons */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <ShieldCheck 
                className="w-8 h-8 text-primary glow-primary" 
                strokeWidth={2}
              />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent drop-shadow-lg">
                File Timestamp
              </h1>
            </div>
            <div className="hidden md:flex">
              <InfoButtons />
            </div>
          </div>

          {/* Right side - Wallet Connection */}
          <NavbarWallet />
        </div>

        {/* Mobile Info Buttons */}
        <div className="md:hidden mt-2 flex justify-center">
          <InfoButtons />
        </div>
      </div>
    </nav>
  );
}