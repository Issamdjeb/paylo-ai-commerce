import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Route, Router, Switch } from "wouter";
import { AuthProvider } from "@/hooks/use-auth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import PayPalAiPage from "@/pages/paypal-ai";
import PayloStudioPage from "@/pages/paylo-studio";
import PayloAgentPage from "@/pages/paylo-agent";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function NotFound() {
  return <main className="min-h-screen bg-slate-950 p-10 text-slate-100"><h1>Paylo page not found</h1><a className="text-cyan-300 underline" href="/paypal-ai">Open Paylo</a></main>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <AuthProvider>
          <TooltipProvider>
            <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Switch>
                <Route path="/" component={PayPalAiPage} />
                <Route path="/paypal-ai" component={PayPalAiPage} />
                <Route path="/paylo-agent" component={PayloAgentPage} />
                <Route path="/paylo-studio" component={PayloStudioPage} />
                <Route component={NotFound} />
              </Switch>
            </Router>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
