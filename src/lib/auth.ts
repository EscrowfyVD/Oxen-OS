import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      console.log("[AUTH] signIn callback - email:", profile?.email)
      if (!profile?.email) {
        console.log("[AUTH] No email in profile, rejecting")
        return false
      }
      const allowed = profile.email.endsWith("@oxen.finance")
      console.log("[AUTH] Domain check:", allowed ? "ALLOWED" : "REJECTED")
      return allowed
    },
    async session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
  debug: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
