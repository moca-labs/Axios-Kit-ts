import path from "node:path";
import { entityKitPlugin } from "@moca-labs/entity-kit-ts/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [entityKitPlugin(), vue()],
  resolve: {
    alias: {
      "@moca-labs/axios-kit-ts": path.resolve(__dirname, "../src/index.ts"),
    },
  },
});
