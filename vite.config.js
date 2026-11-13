import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Номер сборки: страница сверяет его с /version.json и, если Клоузер
// обновился, предлагает обновить страницу (иначе открытая вкладка Safari
// часами работает на старой версии — живой тест 2026-11-13).
const BUILD_ID = String(Date.now());

export default defineConfig({
  plugins: [
    react(),
    {
      name: "klouzer-version",
      generateBundle() {
        this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ build: BUILD_ID }) });
      },
    },
  ],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
});
