import Link from "next/link";
import AdminUsers from "@/components/AdminUsers";
import ReimportButton from "@/components/ReimportButton";
import RescanButton from "@/components/RescanButton";
import { db } from "@/lib/db";

export default async function AdminPage() {
  const [users, audits, counts, assetCount, linkCount, unattached, missing] =
    await Promise.all([
      db.user.findMany({
        include: { identities: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      }),
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      db.artefact.groupBy({ by: ["sheet"], _count: true }),
      db.asset.count(),
      db.artefactAsset.count({ where: { dismissed: false } }),
      db.asset.count({ where: { links: { none: { dismissed: false } } } }),
      db.asset.count({ where: { missing: true } }),
    ]);

  const total = counts.reduce((n, c) => n + c._count, 0);
  const media = { assets: assetCount, links: linkCount, unattached, missing };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted">
          {total} records · {users.length} users
        </p>
      </div>

      <AdminUsers
        users={users.map((u) => ({
          id: u.id,
          label: u.label,
          role: u.role,
          disabled: u.disabled,
          identities: u.identities.map((i) => ({ kind: i.kind, value: i.value })),
        }))}
      />

      <section className="card p-4">
        <h2 className="mb-1 font-medium">Data</h2>
        <p className="mb-3 text-sm text-muted">
          Re-runs the importer against the CSVs in <code>/data</code>. Records are
          matched by sheet and slug and overwritten in place. Nothing is deleted,
          and the previous state of every changed record is kept in the audit log.
        </p>
        <ReimportButton />
      </section>

      <section className="card p-4">
        <h2 className="mb-1 font-medium">Media</h2>
        <p className="mb-3 text-sm text-muted">
          {media.assets} files, {media.links} attached to records,{" "}
          <Link href="/media?show=unattached" className="text-accent hover:underline">
            {media.unattached} unattached
          </Link>
          {media.missing > 0 && (
            <>
              {" · "}
              <span className="text-warn">{media.missing} missing from disk</span>
            </>
          )}
          . Re-scanning picks up new files in <code>/public/assets</code> and leaves
          manual attachments and removals untouched.
        </p>
        <RescanButton />
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Recent activity</h2>
          <span className="text-sm text-muted">last 50</span>
        </div>
        <ul className="space-y-1 text-sm">
          {audits.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 border-b py-1.5 last:border-0">
              <span className="chip">{a.action.toLowerCase()}</span>
              <span className="text-muted">{a.actorLabel ?? "unknown"}</span>
              {a.entity === "Artefact" && a.entityId && a.action !== "IMPORT" ? (
                <Link href={`/r/${a.entityId}`} className="text-accent hover:underline">
                  {recordName(a.before) ?? recordName(a.after) ?? a.entityId}
                </Link>
              ) : (
                <span>{a.entity}</span>
              )}
              <span className="ml-auto text-xs text-muted">
                {a.createdAt.toISOString().replace("T", " ").slice(0, 16)}
              </span>
            </li>
          ))}
          {!audits.length && <li className="text-muted">Nothing yet.</li>}
        </ul>
      </section>
    </div>
  );
}

const recordName = (j: unknown) =>
  j && typeof j === "object" && "name" in j ? String((j as { name: unknown }).name) : null;
