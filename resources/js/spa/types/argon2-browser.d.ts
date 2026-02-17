declare module 'argon2-browser/dist/argon2-bundled.min.js' {
    const argon2: {
        hash: (options: {
            pass: string;
            salt: Uint8Array;
            type: number;
            hashLen: number;
            time: number;
            mem: number;
            parallelism: number;
        }) => Promise<{ hash: Uint8Array }>;
    };

    export default argon2;
}
