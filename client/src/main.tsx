import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// The QueryClientProvider lives in App so every route — and the Suspense
// fallback around the lazy /verify chunk — sits inside it.
createRoot(document.getElementById("root")!).render(<App />);
