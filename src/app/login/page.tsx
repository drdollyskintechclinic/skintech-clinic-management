"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(false);
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirect: false });
    setIsSubmitting(false);
    if (!result?.ok) return setError(true);
    router.replace("/app");
    router.refresh();
  }
  return <main className="login"><form onSubmit={authenticate} className="card"><div><p className="eyebrow">Dr Dolly&apos;s Skintech Clinic</p><h1>Staff sign in</h1><p>Use your assigned staff credentials.</p></div>{error ? <p className="error">Sign-in failed. Check your credentials and try again.</p> : null}<label>Email<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" minLength={12} required /></label><button className="button" type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</button></form></main>;
}
