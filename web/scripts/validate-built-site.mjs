import { validateDiscoveryDocuments } from "./validate-site.mjs";

await validateDiscoveryDocuments(new URL("../dist/", import.meta.url));
console.log("IntegraDraw built Pages discovery validation passed.");
