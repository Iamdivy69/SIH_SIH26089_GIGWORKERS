import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

/**
 * Dev server middleware that handles all /api/* routes directly
 * using the project's mock API handlers in src/server/api.ts.
 */
function apiDevServerPlugin(): Plugin {
  return {
    name: "api-dev-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) {
          return next();
        }

        try {
          const { handle } = await server.ssrLoadModule("/src/server/api.ts");
          const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
          const slug = urlObj.pathname.replace(/^\/api\//, "").split("/").filter(Boolean);

          let body: any = null;
          if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
            const chunks: Uint8Array[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
            const raw = Buffer.concat(chunks).toString("utf-8");
            try {
              body = raw ? JSON.parse(raw) : {};
            } catch {
              body = {};
            }
          }

          const webHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (Array.isArray(value)) {
              value.forEach((v) => webHeaders.append(key, v));
            } else if (value !== undefined) {
              webHeaders.set(key, value);
            }
          }

          const webReq = new Request(urlObj.toString(), {
            method: req.method,
            headers: webHeaders,
            body: body ? JSON.stringify(body) : undefined,
          });

          const response: Response = await handle(webReq, slug);
          const responseBody = await response.text();

          res.writeHead(response.status, {
            "Content-Type": "application/json",
            ...(response.headers ? Object.fromEntries(response.headers.entries()) : {}),
          });
          res.end(responseBody);
        } catch (err: any) {
          console.error("Vite API error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err?.message || "Internal server error" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiDevServerPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
  },
});
