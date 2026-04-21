import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"

// Only require secure cookies when served over HTTPS (production / Railway)
// On http://localhost, secure:true causes browsers to reject the cookies → auth fails
const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  cookies: {
    // Fix PKCE cookie parsing behind Railway reverse proxy
    // Remove __Secure- prefix that can fail when TLS is terminated at the proxy
    // Use secure:false on localhost (http) to avoid cookie rejection
    pkceCodeVerifier: {
      name: "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15, // 15 minutes
      },
    },
    state: {
      name: "authjs.state",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        maxAge: 60 * 15,
      },
    },
    callbackUrl: {
      name: "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      console.log("[AUTH] signIn callback - email:", profile?.email)
      if (!profile?.email) {
        console.log("[AUTH] No email in profile, rejecting")
        return false
      }
      const allowed = profile.email.endsWith("@oxen.finance")
      console.log("[AUTH] Domain check:", allowed ? "ALLOWED" : "REJECTED")
      if (!allowed) return false

      // Force-update the stored account with fresh tokens & scopes from Google.
      // PrismaAdapter does NOT update existing accounts on re-login,
      // so without this, old scopes (missing drive.readonly) persist forever.
      if (account && profile.email) {
        console.log("[AUTH] Account from Google - scope:", account.scope)
        console.log("[AUTH] Account from Google - has access_token:", !!account.access_token)
        console.log("[AUTH] Account from Google - has refresh_token:", !!account.refresh_token)
        try {
          const existingAccount = await prisma.account.findFirst({
            where: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
            select: { id: true, scope: true },
          })
          if (existingAccount) {
            console.log("[AUTH] Found existing account:", existingAccount.id, "Old scope:", existingAccount.scope)
            const updateData: Record<string, unknown> = {
              access_token: account.access_token,
              expires_at: account.expires_at,
              scope: account.scope,
              id_token: account.id_token,
              token_type: account.token_type,
            }
            // Only update refresh_token if Google sent a new one
            if (account.refresh_token) {
              updateData.refresh_token = account.refresh_token
            }
            await prisma.account.update({
              where: { id: existingAccount.id },
              data: updateData,
            })
            console.log("[AUTH] Account tokens updated successfully. New scope:", account.scope)
          } else {
            console.log("[AUTH] No existing account found for providerAccountId:", account.providerAccountId)
          }
        } catch (e) {
          console.error("[AUTH] Failed to update account tokens:", e)
        }
      }

      return true
    },
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
  debug: process.env.NODE_ENV !== "production",
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
