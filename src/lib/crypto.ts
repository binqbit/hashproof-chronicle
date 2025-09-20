import CryptoJS from 'crypto-js';

/**
 * Hash a file to SHA-256 and return as 32-byte array
 */
export async function hashFile(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        const hash = CryptoJS.SHA256(wordArray);
        const hashBytes = new Uint8Array(32);
        
        // Convert hash to bytes
        for (let i = 0; i < 8; i++) {
          const word = hash.words[i];
          hashBytes[i * 4] = (word >>> 24) & 0xff;
          hashBytes[i * 4 + 1] = (word >>> 16) & 0xff;
          hashBytes[i * 4 + 2] = (word >>> 8) & 0xff;
          hashBytes[i * 4 + 3] = word & 0xff;
        }
        
        resolve(hashBytes);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert hash bytes to hex string for display
 */
export function hashToHex(hash: Uint8Array): string {
  return Array.from(hash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to 32-byte array
 */
export function hexToHash(hex: string): Uint8Array {
  if (hex.length !== 64) {
    throw new Error('Hex string must be exactly 64 characters (32 bytes)');
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Format SOL amount for display
 */
export function formatSOL(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toLocaleString();
}