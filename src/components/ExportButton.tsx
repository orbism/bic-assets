"use client";

import { useSearchParams } from "next/navigation";
import type { Sheet } from "@/generated/prisma/enums";

/** Exports exactly the current filter set, so what you see is what you get. */
export default function ExportButton({ sheet }: { sheet?: Sheet }) {
  const params = useSearchParams();
  const q = new URLSearchParams(params.toString());
  if (sheet) q.set("sheet", sheet);
  q.delete("page");

  return (
    <a className="btn" href={`/api/export?${q}`} download>
      Export CSV
    </a>
  );
}
