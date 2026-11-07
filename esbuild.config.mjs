// Bundles main.ts into main.js, the single file Obsidian loads.
// `npm run dev` rebuilds on every save; `npm run build` makes a minified release build.
import esbuild from "esbuild";

const prod = process.argv[2] === "production";

const ctx = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  external: ["obsidian"], // provided by Obsidian at runtime
  format: "cjs",
  target: "es2020",
  outfile: "main.js",
  sourcemap: prod ? false : "inline",
  minify: prod,
  logLevel: "info",
});

if (prod) {
  await ctx.rebuild();
  process.exit(0);
} else {
  await ctx.watch();
}
