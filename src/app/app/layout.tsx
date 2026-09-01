import Link from "next/link";

import { requireAuth } from "@/server/auth/authorization";

export default async function ApplicationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAuth();
  return <div className="shell"><aside className="sidebar"><div className="brand">Skintech Clinic<small>Secure platform foundation</small></div><nav className="nav" aria-label="Application navigation"><Link href="/app">Foundation status</Link></nav><small>{user.email}</small></aside><main className="content">{children}</main></div>;
}

