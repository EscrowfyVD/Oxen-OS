"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function LoginContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const callbackUrl = searchParams.get("callbackUrl") ?? "/"

  const errorMessages: Record<string, string> = {
    OAuthCallbackError: "OAuth callback failed — check Google Cloud Console redirect URIs",
    OAuthSignin: "Could not start OAuth flow — check Google Client ID/Secret",
    OAuthAccountNotLinked: "This email is already linked to another account",
    AccessDenied: "Access denied — only @oxen.finance accounts allowed",
    Callback: "Callback error — check server logs",
    Default: "Authentication error — please try again",
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
      <div className="card p-8 w-full max-w-sm text-center">
        {/* Brand Mark */}
        <div className="flex justify-center mb-6">
          <div
            className="flex items-center justify-center font-bold text-3xl"
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "linear-gradient(135deg, #C08B88, #D4A5A2)",
              color: "#0F1419",
              fontFamily: "var(--font-display)",
            }}
          >
            O
          </div>
        </div>

        <h1
          className="text-xl font-semibold mb-1"
          style={{ color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}
        >
          Oxen OS
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--text-dim)" }}>
          Internal Dashboard — Sign in with your @oxen.finance account
        </p>

        {error && (
          <div
            className="mb-4 p-3 rounded-lg text-xs text-left"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
            }}
          >
            <div className="font-semibold mb-1">Sign-in error</div>
            <div>{errorMessages[error] ?? errorMessages.Default}</div>
            <div className="mt-1" style={{ color: "var(--text-dim)" }}>
              Code: {error}
            </div>
          </div>
        )}

        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
          style={{ padding: "12px 20px" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>

        <p className="text-xs mt-6" style={{ color: "var(--text-dim)" }}>
          Restricted to @oxen.finance accounts only
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
