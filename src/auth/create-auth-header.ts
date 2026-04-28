import { RmConfigError } from "../errors/index.js";

import type { RmAuth } from "./auth-types.js";

export async function createAuthHeader(auth: RmAuth): Promise<string> {
  if (auth.type === "basic") {
    const { username, password } = auth;
    if (!username) {
      throw new RmConfigError("Basic auth exige username não vazio.");
    }
    const encoded = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
    return `Basic ${encoded}`;
  }

  if (auth.type === "bearer") {
    if ("token" in auth) {
      if (!auth.token) {
        throw new RmConfigError("Bearer auth exige token não vazio.");
      }
      return `Bearer ${auth.token}`;
    }
    const token = await auth.getToken();
    if (!token) {
      throw new RmConfigError("getToken() retornou valor vazio.");
    }
    return `Bearer ${token}`;
  }

  throw new RmConfigError(`Tipo de auth não suportado: ${(auth as { type: string }).type}`);
}
