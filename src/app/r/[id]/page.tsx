import { notFound } from "next/navigation";
import Link from "next/link";
import RecordEditor from "@/components/RecordEditor";
import { db } from "@/lib/db";
import { SHEET_BY_ENUM } from "@/lib/sheets";
import { ASSET_INCLUDE, assetsOf } from "@/lib/media";
import MediaGallery from "@/components/MediaGallery";
import { atLeast, getSession } from "@/lib/session";

export default async function RecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [record, session] = await Promise.all([
    db.artefact.findUnique({
      where: { id },
      include: {
        memecoin: true,
        nft: true,
        collection: true,
        provfi: true,
        ...ASSET_INCLUDE,
      },
    }),
    getSession(),
  ]);
  if (!record) notFound();

  const def = SHEET_BY_ENUM.get(record.sheet);
  const canEdit = !!session && atLeast(session.role, "EDITOR");

  // History names the people who made each change, so it stays behind sign-in
  // even though the record itself is public.
  const history = session
    ? await db.auditLog.findMany({
        where: { entity: "Artefact", entityId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href={`/s/${def?.slug ?? ""}`} className="hover:text-text">
          {def?.title ?? record.sheet}
        </Link>
        <span>/</span>
        <span className="text-text">{record.name}</span>
        {record.needsReview && (
          <span className="chip border-warn/40 text-warn">needs review</span>
        )}
      </div>

      <MediaGallery
        assets={assetsOf(record)}
        artefactId={record.id}
        canEdit={canEdit}
      />

      <RecordEditor
        record={JSON.parse(JSON.stringify(record))}
        cols={def?.cols ?? []}
        canEdit={canEdit}
      />

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Original imported row
        </summary>
        <p className="mt-1 text-xs text-muted">
          {record.sourceSheet
            ? `${record.sourceSheet}, line ${record.sourceLine}`
            : "Created in the app"}
        </p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs">
          {JSON.stringify(record.sourceRow ?? {}, null, 2)}
        </pre>
      </details>

      {session && (
      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          History ({history.length})
        </summary>
        <ul className="mt-2 space-y-1.5 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex gap-2 text-muted">
              <span className="chip">{h.action.toLowerCase()}</span>
              <span>{h.actorLabel ?? "unknown"}</span>
              <span className="ml-auto">
                {h.createdAt.toISOString().replace("T", " ").slice(0, 16)}
              </span>
            </li>
          ))}
          {!history.length && (
            <li className="text-muted">No changes since import.</li>
          )}
        </ul>
      </details>
      )}
    </div>
  );
}
