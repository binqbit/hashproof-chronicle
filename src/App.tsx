import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AppWalletProvider } from "./components/WalletProvider";
import { AppPages } from "./components/AppPages";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppWalletProvider>
          <AppPages />
        </AppWalletProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
