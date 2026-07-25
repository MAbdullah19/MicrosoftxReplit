import { Link } from "wouter";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <HelpCircle className="h-12 w-12 text-muted-fg" aria-hidden />
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-base text-muted-fg">This page does not exist.</p>
      <Link href="/">
        <Button variant="secondary">Back to search</Button>
      </Link>
    </main>
  );
}
