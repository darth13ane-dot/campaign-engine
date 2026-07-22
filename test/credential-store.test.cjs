const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { FOUNDRY_CREDENTIAL_FILE, createCredentialStore } = require("../electron/credential-store.cjs");

function protectedStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: value => Buffer.from(value, "utf8").map(byte => byte ^ 0x5a),
    decryptString: value => Buffer.from(value).map(byte => byte ^ 0x5a).toString("utf8")
  };
}

async function temporaryStore(t, safeStorage = protectedStorage()) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-credentials-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return createCredentialStore({ directory, safeStorage });
}

test("stores an encrypted API key outside the portable executable", async t => {
  const store = await temporaryStore(t);

  assert.deepEqual(await store.loadApiKey(), { saved: false, apiKey: "" });
  assert.deepEqual(await store.saveApiKey("sk-portable-secret"), { saved: true });

  const storedText = await fs.readFile(store.credentialPath, "utf8");
  assert.doesNotMatch(storedText, /sk-portable-secret/);
  assert.deepEqual(await store.loadApiKey(), { saved: true, apiKey: "sk-portable-secret" });
});

test("clears a saved API key without failing when it is already absent", async t => {
  const store = await temporaryStore(t);
  await store.saveApiKey("sk-clear-me");

  assert.deepEqual(await store.clearApiKey(), { saved: false });
  assert.deepEqual(await store.clearApiKey(), { saved: false });
  assert.deepEqual(await store.loadApiKey(), { saved: false, apiKey: "" });
});

test("refuses to persist plaintext when operating-system encryption is unavailable", async t => {
  const store = await temporaryStore(t, protectedStorage(false));

  await assert.rejects(() => store.saveApiKey("sk-no-encryption"), /encryption is not available/);
});

test("reports damaged credential records without exposing their contents", async t => {
  const store = await temporaryStore(t);
  await fs.mkdir(path.dirname(store.credentialPath), { recursive: true });
  await fs.writeFile(store.credentialPath, "{\"schemaVersion\":1,\"ciphertext\":\"%%%\"}", "utf8");

  await assert.rejects(() => store.loadApiKey(), /could not decrypt/);
});

test("keeps Foundry and AI credentials in separate encrypted records", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "campaign-engine-credentials-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const safeStorage = protectedStorage();
  const aiStore = createCredentialStore({ directory, safeStorage });
  const foundryStore = createCredentialStore({
    directory,
    safeStorage,
    fileName: FOUNDRY_CREDENTIAL_FILE,
    credentialName: "Foundry API key"
  });

  await aiStore.saveApiKey("sk-ai-secret");
  await foundryStore.saveApiKey("pk_foundry-secret");

  assert.notEqual(aiStore.credentialPath, foundryStore.credentialPath);
  assert.deepEqual(await aiStore.loadApiKey(), { saved: true, apiKey: "sk-ai-secret" });
  assert.deepEqual(await foundryStore.loadApiKey(), { saved: true, apiKey: "pk_foundry-secret" });
  const foundryRecord = await fs.readFile(foundryStore.credentialPath, "utf8");
  assert.doesNotMatch(foundryRecord, /pk_foundry-secret/);
});
