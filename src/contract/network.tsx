import { createContext, ReactNode, useContext, useRef, useState } from "react";

export interface Network {
  key: string;
  label: string;
  endpoint: string;
  cluster?: string;
}
const builtInNetworks: Network[] = [
  { key: "localnet", label: "Localnet", endpoint: "http://127.0.0.1:8899" },
  {
    key: "devnet",
    label: "Devnet",
    endpoint: "https://api.devnet.solana.com",
    cluster: "devnet",
  },
  {
    key: "testnet",
    label: "Testnet",
    endpoint: "https://api.testnet.solana.com",
    cluster: "testnet",
  },
];

export function configuredNetworks(rpc?: string): Network[] {
  if (!rpc) return builtInNetworks;
  const url = new URL(rpc);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("RPC must be an HTTP(S) URL without credentials");
  return [
    { key: "custom", label: "Custom RPC", endpoint: url.toString() },
    ...builtInNetworks,
  ];
}

interface NetworkState {
  network: Network;
  networks: Network[];
  setNetwork(key: string): void;
  busy: boolean;
  acquire(): boolean;
  release(): void;
}
const Context = createContext<NetworkState | null>(null);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [networks] = useState(() =>
    configuredNetworks(import.meta.env.VITE_SOLANA_RPC_URL),
  );
  const [key, setKey] = useState(
    import.meta.env.VITE_SOLANA_RPC_URL
      ? "custom"
      : import.meta.env.VITE_SOLANA_NETWORK || "localnet",
  );
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const network = networks.find((item) => item.key === key) || networks[0];
  return (
    <Context.Provider
      value={{
        network,
        networks,
        busy,
        setNetwork: (next) => {
          if (!lock.current && networks.some((item) => item.key === next))
            setKey(next);
        },
        acquire: () => {
          if (lock.current) return false;
          lock.current = true;
          setBusy(true);
          return true;
        },
        release: () => {
          lock.current = false;
          setBusy(false);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useNetwork() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing NetworkProvider");
  return context;
}

export function explorerUrl(
  network: Network,
  kind: "tx" | "address",
  value: string,
) {
  const url = new URL(
    `https://explorer.solana.com/${kind}/${encodeURIComponent(value)}`,
  );
  url.searchParams.set("cluster", network.cluster || "custom");
  if (!network.cluster) url.searchParams.set("customUrl", network.endpoint);
  return url.toString();
}
