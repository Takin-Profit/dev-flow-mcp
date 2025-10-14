import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts", "src/cli/index.ts", "src/cli/bash-complete.ts"],
  format: ["esm"],
  target: "esnext",
  clean: true,
  dts: true,
  sourcemap: true,
  outDir: "dist",
  splitting: false,
  treeshake: true,
})
