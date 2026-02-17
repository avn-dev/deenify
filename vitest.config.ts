import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['/Users/avn/Dev/Personal/deenify/resources/js/spa/test/setup.ts'],
    },
});
