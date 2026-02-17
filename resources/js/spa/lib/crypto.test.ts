import { buildPbkdf2Params, decryptJson, deriveKey, encryptJson, generateDek, unwrapKey, wrapKey } from './crypto';

test('AES-GCM encrypt/decrypt roundtrip', async () => {
    const dek = await generateDek();
    const payload = { mood: 3, text: 'Hallo' };

    const encrypted = await encryptJson(payload, dek);
    const decrypted = await decryptJson<typeof payload>(encrypted, dek);

    expect(decrypted).toEqual(payload);
});

test('wrap/unwrap DEK with PBKDF2 key', async () => {
    const params = buildPbkdf2Params();
    const mk = await deriveKey('test-passphrase', params);
    const dek = await generateDek();

    const wrapped = await wrapKey(dek, mk);
    const unwrapped = await unwrapKey(wrapped, mk);

    const sample = { fasted: true };
    const encrypted = await encryptJson(sample, unwrapped);
    const decrypted = await decryptJson<typeof sample>(encrypted, dek);

    expect(decrypted).toEqual(sample);
});
