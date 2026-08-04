import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Header, Footer, PageBackdrop } from "@/components/Shell";
import { ClickSpark } from "@/components/fx";
import { Skeleton } from "@/components/ui/controls";
import Home from "@/pages/Home";
import Subject from "@/pages/Subject";
import Claim from "@/pages/Claim";
import NotFound from "@/pages/NotFound";
import Join from "@/pages/Join";
import MePage from "@/pages/Me";

// /verify pulls in viem (~600 KB raw) to read the chain. It is one route, and
// the checker path must stay light on mobile data (§6), so it loads on demand.
const Verify = lazy(() => import("@/pages/Verify"));

function RouteFallback() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-16">
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </main>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PageBackdrop />
      <ClickSpark />
      <div className="flex min-h-screen flex-col">
        <Header />
        {/* flex-1 so the footer sits at the bottom on short pages rather than
            floating halfway up. */}
        <div className="flex-1">
          <Suspense fallback={<RouteFallback />}>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/s/:subjectKey" component={Subject} />
              <Route path="/c/:id" component={Claim} />
              <Route path="/verify" component={Verify} />
              <Route path="/join" component={Join} />
              <Route path="/me" component={MePage} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </div>
        <Footer />
      </div>
    </QueryClientProvider>
  );
}
