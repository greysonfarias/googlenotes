export async function getAccessToken(session: {
  accessToken?: string;
  error?: string;
}): Promise<string> {
  if (session.error === "RefreshAccessTokenError") {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  if (!session.accessToken) {
    throw new Error("Sem token de acesso. Faça login.");
  }
  return session.accessToken;
}
