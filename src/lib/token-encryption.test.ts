import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  encrypt,
  decrypt,
  isEncrypted,
  encryptNullable,
  decryptNullable,
} from "./token-encryption";
import { randomBytes } from "node:crypto";

describe("token-encryption", () => {
  const originalKey = process.env.TOKEN_ENCRYPTION_KEY_V1;

  beforeAll(() => {
    // Clé de test — NE PAS utiliser en prod
    process.env.TOKEN_ENCRYPTION_KEY_V1 = randomBytes(32).toString("base64");
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.TOKEN_ENCRYPTION_KEY_V1;
    } else {
      process.env.TOKEN_ENCRYPTION_KEY_V1 = originalKey;
    }
  });

  describe("round-trip", () => {
    it("encrypts and decrypts a simple string", () => {
      const plaintext = "ya29.a0AfB_byC4...fakegoogletoken";
      const encrypted = encrypt(plaintext);
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.startsWith("enc:v1:")).toBe(true);
      expect(decrypt(encrypted)).toBe(plaintext);
    });

    it("produces different ciphertext each call (IV randomness)", () => {
      const plaintext = "same input";
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);
      expect(c1).not.toBe(c2);
      expect(decrypt(c1)).toBe(plaintext);
      expect(decrypt(c2)).toBe(plaintext);
    });

    it("handles empty string", () => {
      const encrypted = encrypt("");
      expect(decrypt(encrypted)).toBe("");
    });

    it("handles unicode characters", () => {
      const plaintext = "tëst 🔐 éàü 中文";
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it("handles long tokens (typical OAuth refresh tokens)", () => {
      const plaintext = "x".repeat(2048);
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });
  });

  describe("idempotence", () => {
    it("does not re-encrypt already-encrypted strings", () => {
      const encrypted = encrypt("hello");
      const twice = encrypt(encrypted);
      expect(twice).toBe(encrypted);
    });

    it("passes through plaintext on decrypt if not encrypted format", () => {
      const legacy = "ya29.plainlegacyaccesstoken";
      expect(decrypt(legacy)).toBe(legacy);
    });
  });

  describe("isEncrypted detector", () => {
    it("returns true for valid encrypted format", () => {
      expect(isEncrypted(encrypt("any"))).toBe(true);
    });
    it("returns false for plain strings", () => {
      expect(isEncrypted("plain")).toBe(false);
      expect(isEncrypted("enc:v2:xxx")).toBe(false); // future version
      expect(isEncrypted("")).toBe(false);
    });
    it("returns false for null/undefined", () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
    });
  });

  describe("nullable helpers", () => {
    it("encryptNullable passes through null/undefined", () => {
      expect(encryptNullable(null)).toBe(null);
      expect(encryptNullable(undefined)).toBe(null);
    });
    it("encryptNullable encrypts non-null", () => {
      const encrypted = encryptNullable("x");
      expect(encrypted).toBeTruthy();
      expect(decryptNullable(encrypted)).toBe("x");
    });
  });

  describe("tampering detection", () => {
    it("throws when ciphertext is modified", () => {
      const encrypted = encrypt("hello world");
      // Flip a character in the ciphertext portion
      const parts = encrypted.split(":");
      const tampered = parts
        .map((p, i) => (i === 3 ? p.slice(0, -2) + "XX" : p))
        .join(":");
      expect(() => decrypt(tampered)).toThrow();
    });

    it("throws when auth tag is modified", () => {
      const encrypted = encrypt("hello world");
      const parts = encrypted.split(":");
      const tampered = parts
        .map((p, i) => (i === 4 ? p.slice(0, -2) + "XX" : p))
        .join(":");
      expect(() => decrypt(tampered)).toThrow();
    });

    it("throws on malformed ciphertext", () => {
      expect(() => decrypt("enc:v1:only-two-parts")).toThrow();
    });
  });

  describe("key validation", () => {
    it("throws if key is missing", () => {
      const saved = process.env.TOKEN_ENCRYPTION_KEY_V1;
      delete process.env.TOKEN_ENCRYPTION_KEY_V1;
      expect(() => encrypt("x")).toThrow(/TOKEN_ENCRYPTION_KEY_V1/);
      process.env.TOKEN_ENCRYPTION_KEY_V1 = saved;
    });

    it("throws if key is wrong length", () => {
      const saved = process.env.TOKEN_ENCRYPTION_KEY_V1;
      process.env.TOKEN_ENCRYPTION_KEY_V1 = Buffer.from("tooshort").toString(
        "base64"
      );
      expect(() => encrypt("x")).toThrow(/32 bytes/);
      process.env.TOKEN_ENCRYPTION_KEY_V1 = saved;
    });
  });
});
