import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    splitting: false,
    sourcemap: true,
    target: "node18",
    outDir: "dist",
  },
  {
    entry: { "catalog/index": "src/catalog/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: false,
    splitting: false,
    sourcemap: true,
    target: "node18",
    outDir: "dist",
    loader: { ".json": "json" },
  },
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    dts: false,
    clean: false,
    splitting: false,
    sourcemap: true,
    target: "node18",
    outDir: "dist",
    banner: { js: "#!/usr/bin/env node" },
    loader: { ".json": "json" },
  },
]);
