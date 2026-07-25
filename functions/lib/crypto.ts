const encoder = new TextEncoder();

const bytesToHex = (bytes: Uint8Array) => {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

export const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(digest);
};

export const sha256Hex = async (value: string) => bytesToHex(await sha256(value));

export const secureTextEqual = async (first: string, second: string) => {
  const [firstDigest, secondDigest] = await Promise.all([sha256(first), sha256(second)]);
  let difference = firstDigest.length ^ secondDigest.length;
  const length = Math.max(firstDigest.length, secondDigest.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (firstDigest[index] || 0) ^ (secondDigest[index] || 0);
  }
  return difference === 0;
};

export const hmacSha256Hex = async (secret: string, value: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(new Uint8Array(signature));
};

export const createRandomToken = (byteLength = 32) => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
};
