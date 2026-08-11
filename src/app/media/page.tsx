import MediaBrowser from "@/components/MediaBrowser";
import { db } from "@/lib/db";
import { atLeast, getSession } from "@/lib/session";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const only = Array.isArray(sp.show) ? sp.show[0] : sp.show;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim();

  const [assets, session] = await Promise.all([
    db.asset.findMany({
      where: {
        ...(q ? { label: { contains: q, mode: "insensitive" } } : {}),
        ...(only === "unattached"
          ? { links: { none: { dismissed: false } } }
          : only === "attached"
            ? { links: { some: { dismissed: false } } }
            : {}),
      },
      include: {
        links: {
          where: { dismissed: false },
          include: { artefact: { select: { id: true, name: true, sheet: true } } },
        },
      },
      orderBy: [{ folder: "asc" }, { label: "asc" }],
    }),
    getSession(),
  ]);

  const counts = await db.asset.groupBy({ by: ["kind"], _count: true });

  return (
    <MediaBrowser
      assets={assets.map((a) => ({
        id: a.id,
        path: a.path,
        thumbPath: a.thumbPath,
        kind: a.kind as "IMAGE" | "VIDEO",
        label: a.label,
        bytes: a.bytes,
        missing: a.missing,
        folder: a.folder,
        attachedTo: a.links.map((l) => ({
          id: l.artefact.id,
          name: l.artefact.name,
          sheet: l.artefact.sheet,
        })),
      }))}
      totals={{
        images: counts.find((c) => c.kind === "IMAGE")?._count ?? 0,
        videos: counts.find((c) => c.kind === "VIDEO")?._count ?? 0,
      }}
      canEdit={!!session && atLeast(session.role, "EDITOR")}
    />
  );
}
