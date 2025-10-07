import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        dir: "tests",
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
        setupFiles: [],
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    root: rootDir,
});
