"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export default function MediaUpload({ artefactId }: { artefactId?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // Loaded on demand so the blob client is not in the main bundle.
      const { upload } = await import("@vercel/blob/client");
      await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/assets/upload",
        clientPayload: artefactId ?? undefined,
      });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("BLOB_READ_WRITE_TOKEN")
            ? "Blob storage is not configured. Set BLOB_READ_WRITE_TOKEN."
            : err.message
          : "Upload failed",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <span className="flex items-center gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        onChange={onPick}
        className="hidden"
      />
      <button
        className="btn"
        onClick={() => input.current?.click()}
        disabled={busy}
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </span>
  );
}
