import plugin from "./dist/index.js";

// Plugin can be either a function (old style) or an object with register method (new style)
const valid = typeof plugin === "function" || (typeof plugin === "object" && plugin !== null && typeof (plugin as any).register === "function");

if (!valid) {
  throw new Error(`verify-import failed: expected function or {register}, got ${typeof plugin}`);
}

console.log("verify-import: ok");
