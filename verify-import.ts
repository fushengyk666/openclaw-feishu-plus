import plugin from "./dist/index.js";

if (typeof plugin !== "function") {
  throw new Error(`verify-import failed: expected function, got ${typeof plugin}`);
}

console.log("verify-import: ok");
