import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

export default defineConfig(({ command }) => {
  const version = command === "build" ? randomUUID() : "development";
  return {
    define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(version) },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "app-version",
        generateBundle() {
          this.emitFile({
            type: "asset",
            fileName: "version.json",
            source: JSON.stringify({ version }),
          });
        },
        configureServer(server) {
          server.middlewares.use("/version.json", (_request, response) => {
            response.setHeader("Content-Type", "application/json");
            response.setHeader("Cache-Control", "no-store");
            response.end(JSON.stringify({ version }));
          });
        },
      },
    ],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: { "/api": "http://127.0.0.1:8787" },
    },
  };
});
