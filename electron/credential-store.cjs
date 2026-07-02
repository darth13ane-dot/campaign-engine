const fs = require("node:fs/promises");
const path = require("node:path");

const CREDENTIAL_SCHEMA_VERSION = 1;
const CREDENTIAL_FILE = "ai-credential.json";

function createCredentialStore({ directory, safeStorage, fsImpl = fs }) {
  if (!directory) throw new Error("A credential directory is required.");

  const credentialPath = path.join(directory, CREDENTIAL_FILE);

  function requireEncryption() {
    if (!safeStorage?.isEncryptionAvailable?.()) {
      throw new Error("Windows credential encryption is not available.");
    }
  }

  async function loadApiKey() {
    let record;
    try {
      record = JSON.parse(await fsImpl.readFile(credentialPath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return { saved: false, apiKey: "" };
      throw new Error("The saved API key could not be read.");
    }

    if (record?.schemaVersion !== CREDENTIAL_SCHEMA_VERSION || typeof record.ciphertext !== "string") {
      throw new Error("The saved API key has an unsupported format.");
    }

    requireEncryption();
    try {
      const apiKey = safeStorage.decryptString(Buffer.from(record.ciphertext, "base64")).trim();
      if (!apiKey) throw new Error("empty");
      return { saved: true, apiKey };
    } catch {
      throw new Error("Windows could not decrypt the saved API key for this account.");
    }
  }

  async function saveApiKey(value) {
    const apiKey = String(value || "").trim();
    if (!apiKey) throw new Error("Enter an API key before saving it.");
    requireEncryption();

    const record = {
      schemaVersion: CREDENTIAL_SCHEMA_VERSION,
      ciphertext: safeStorage.encryptString(apiKey).toString("base64")
    };
    const temporaryPath = `${credentialPath}.${process.pid}.tmp`;
    await fsImpl.mkdir(directory, { recursive: true });
    await fsImpl.writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    try {
      await fsImpl.rename(temporaryPath, credentialPath);
    } catch (error) {
      if (!["EEXIST", "EPERM"].includes(error.code)) throw error;
      await fsImpl.unlink(credentialPath).catch(() => {});
      await fsImpl.rename(temporaryPath, credentialPath);
    }
    return { saved: true };
  }

  async function clearApiKey() {
    await fsImpl.unlink(credentialPath).catch(error => {
      if (error.code !== "ENOENT") throw error;
    });
    return { saved: false };
  }

  return {
    credentialPath,
    loadApiKey,
    saveApiKey,
    clearApiKey
  };
}

module.exports = {
  CREDENTIAL_FILE,
  CREDENTIAL_SCHEMA_VERSION,
  createCredentialStore
};
