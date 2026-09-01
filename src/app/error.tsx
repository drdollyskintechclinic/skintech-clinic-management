"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <html lang="en-IN"><body><main className="login"><section className="card"><p className="eyebrow">Unexpected error</p><h1>Something went wrong</h1><p>Try again. If the problem continues, contact the clinic administrator.</p><button className="button" onClick={reset}>Try again</button></section></main></body></html>;
}

