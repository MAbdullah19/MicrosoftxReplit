/** Placeholder shell — real pages (Home, Subject, Claim, Verify, Join, Me)
 *  land in later milestones. */
import { Route, Switch } from "wouter";
import { ShieldCheck } from "lucide-react";
import { STRINGS } from "@shared/strings";

function Placeholder() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldCheck className="h-12 w-12 text-brand" aria-hidden />
      <h1 className="text-3xl font-semibold tracking-tight">{STRINGS.productName}</h1>
      <p className="text-base text-muted-fg max-w-md">{STRINGS.tagline}</p>
      <p className="text-sm text-muted-fg">Foundation build — pages coming next.</p>
    </main>
  );
}

export default function App() {
  return (
    <Switch>
      <Route>
        <Placeholder />
      </Route>
    </Switch>
  );
}
