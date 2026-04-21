import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/http_server.ts", "src/auth-cli.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node22",
  platform: "node",
  sourcemap: true,
  clean: true,
  dts: false,
  splitting: false,
  bundle: true,
  skipNodeModulesBundle: true,
  shims: false,
});
