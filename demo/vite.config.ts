import path from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig, transformWithEsbuild } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "lower-tc39-decorators",
      enforce: "pre",
      async transform(code, id) {
        if (!/\.(ts|tsx)$/.test(id)) return null;
        return transformWithEsbuild(code, id, {
          target: "es2022",
          supported: { decorators: false },
          loader: id.endsWith(".tsx") ? "tsx" : "ts",
        });
      },
    },
    vue(),
  ],
  resolve: {
    alias: {
      "@moca-labs/axios-kit-ts": path.resolve(__dirname, "../src/index.ts"),
    },
  },
});
