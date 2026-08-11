"use client";

/**
 * Production strips server error messages, leaving only a digest. Showing the
 * digest here is what makes it possible to find the matching line in the
 * host's runtime logs instead of guessing.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="card mx-auto max-w-lg space-y-3 p-6">
      <h1 className="font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted">
        This page failed to render. The details are in the server logs.
      </p>
      {error.digest && (
        <p className="text-sm">
          <span className="text-muted">Error digest: </span>
          <code className="chip font-mono">{error.digest}</code>
        </p>
      )}
      {process.env.NODE_ENV !== "production" && (
        <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs">
          {error.message}
        </pre>
      )}
      <button className="btn" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
