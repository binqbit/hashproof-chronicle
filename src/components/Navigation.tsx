import React from 'react';
import { WalletConnection } from './WalletConnection';
import { InfoButtons } from './InfoDialogs';

export function Navigation() {
  return (
    <nav className="bg-background/95 backdrop-blur-sm border-b border-border/40 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Title */}
          <div className="flex items-center">
            <h1 className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">
              File Timestamp
            </h1>
          </div>

          {/* Center - Info Buttons */}
          <div className="hidden md:flex items-center">
            <InfoButtons />
          </div>

          {/* Right side - Wallet Connection */}
          <div className="flex items-center">
            <WalletConnection />
          </div>
        </div>

        {/* Mobile Info Buttons */}
        <div className="md:hidden mt-4 flex justify-center">
          <InfoButtons />
        </div>
      </div>
    </nav>
  );
}