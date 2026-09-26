// Never runs: wrangler's `main` is launch.ts. The file has to exist because `vinext deploy`
// generates its own entry here when it is missing.
export { default } from "./launch";
