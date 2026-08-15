# Vendored plugin conventions build

`index.mjs` is the browser-safe ESM build copied from the local Aurelia `@aurelia/plugin-conventions` working tree based on commit `4ff60906593bdedc9f9dc6003606ba138df87f0e`.

The local build's TypeScript compatibility import is redirected to the JavaScript `typescript` package because the native TypeScript 6 package cannot execute in a browser worker.

It is used only by the in-browser playground compiler. The documentation app's released `@aurelia/vite-plugin` remains unchanged and continues using its normal Node dependency.

After changing the upstream convention implementation, rebuild `packages-tooling/plugin-conventions` in the Aurelia repository and copy `dist/esm/index.mjs` here. Delete this vendor directory and import the released package when the environment-neutral host API ships.
