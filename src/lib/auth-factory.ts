import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { readConfig } from "./config.server";

export function createNextAuth() {
  const config = readConfig();

  return NextAuth({
    providers: config.configured
      ? [
          Google({
            clientId: config.googleClientId,
            clientSecret: config.googleClientSecret,
            authorization: {
              params: {
                scope:
                  "openid email profile https://www.googleapis.com/auth/drive.file",
                access_type: "offline",
                prompt: "consent",
              },
            },
          }),
        ]
      : [],
    secret: config.authSecret,
    callbacks: {
      async jwt({ token, account }) {
        if (account) {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.expiresAt = account.expires_at;
        }

        const expiresAt = token.expiresAt as number | undefined;
        if (expiresAt && Date.now() < expiresAt * 1000 - 60_000) {
          return token;
        }

        if (!token.refreshToken) {
          return { ...token, error: "RefreshAccessTokenError" };
        }

        try {
          const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: config.googleClientId,
              client_secret: config.googleClientSecret,
              grant_type: "refresh_token",
              refresh_token: token.refreshToken as string,
            }),
          });

          const refreshed = await res.json();
          if (!res.ok) throw refreshed;

          return {
            ...token,
            accessToken: refreshed.access_token,
            expiresAt: Math.floor(Date.now() / 1000 + refreshed.expires_in),
            refreshToken: refreshed.refresh_token ?? token.refreshToken,
          };
        } catch {
          return { ...token, error: "RefreshAccessTokenError" };
        }
      },

      async session({ session, token }) {
        return {
          ...session,
          accessToken: token.accessToken as string,
          error: token.error as string | undefined,
        };
      },
    },
    pages: {
      signIn: "/login",
    },
  });
}

export async function getServerSession() {
  const { auth } = createNextAuth();
  return auth();
}
