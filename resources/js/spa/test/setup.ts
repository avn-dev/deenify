import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
    // @ts-expect-error Node crypto typing
    globalThis.crypto = webcrypto;
}
