import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { env } from "./env";
import { api } from "./routes/index";

const app = express();
app.use(express.json());
app.use(cookieParser());

app.use("/api", api);

// Open the port immediately; the SPA middleware attaches right after.
const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`attest listening on http://0.0.0.0:${env.PORT} (${env.NODE_ENV})`);
});

async function attachSpa() {
  if (env.NODE_ENV === "development") {
    // Vite in middleware mode inside the same Express process — no second
    // port, no proxy, no CORS (§3.1). HMR shares this HTTP server.
    const { createServer } = await import("vite");
    const vite = await createServer({
      configFile: path.resolve(import.meta.dirname, "..", "vite.config.ts"),
      server: { middlewareMode: true, hmr: { server } },
      appType: "custom",
    });
    app.use(vite.middlewares);
    // In middleware mode Vite does not serve index.html itself — do the
    // SPA fallback here with transformIndexHtml so HMR client is injected.
    const { readFile } = await import("node:fs/promises");
    const indexPath = path.resolve(import.meta.dirname, "..", "client", "index.html");
    app.use("*", async (req, res, next) => {
      try {
        const raw = await readFile(indexPath, "utf8");
        const html = await vite.transformIndexHtml(req.originalUrl, raw);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        next(e);
      }
    });
    console.log("vite dev middleware ready");
  } else {
    const dist = path.resolve(import.meta.dirname, "..", "client", "dist");
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }
}

attachSpa().catch((err) => {
  console.error("FATAL: failed to attach SPA middleware", err);
  process.exit(1);
});
