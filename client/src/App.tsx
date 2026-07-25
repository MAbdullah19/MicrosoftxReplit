import { Route, Switch, Link } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { queryClient } from "./lib/queryClient";
import Home from "@/pages/Home";
import Subject from "@/pages/Subject";
import Claim from "@/pages/Claim";
import NotFound from "@/pages/NotFound";
import Join from "@/pages/Join";
import MePage from "@/pages/Me";

function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <ShieldCheck className="h-6 w-6 text-brand" aria-hidden />
          {STRINGS.productName}
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-fg">
          <Link href="/verify" className="hover:text-fg">Verify</Link>
          <Link href="/join" className="hover:text-fg">Join</Link>
          <Link href="/me" className="hover:text-fg">My account</Link>
        </nav>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Header />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/s/:subjectKey" component={Subject} />
        <Route path="/c/:id" component={Claim} />
        <Route path="/join" component={Join} />
        <Route path="/me" component={MePage} />
        <Route component={NotFound} />
      </Switch>
    </QueryClientProvider>
  );
}
