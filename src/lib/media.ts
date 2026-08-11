import type { MediaAsset } from "@/components/MediaModal";
import type { Prisma } from "@/generated/prisma/client";

/** Include clause for pulling a record's live (non-dismissed) media. */
export const ASSET_INCLUDE = {
  assets: {
    where: { dismissed: false },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { asset: true },
  },
} satisfies Prisma.ArtefactInclude;

type WithAssets = {
  assets?: {
    asset: {
      id: string;
      path: string;
      thumbPath: string | null;
      kind: string;
      label: string;
      bytes: number | null;
      missing: boolean;
    };
  }[];
};

/** Flatten the join rows a record arrives with into modal-ready assets. */
export function assetsOf(row: unknown): MediaAsset[] {
  const links = (row as WithAssets)?.assets ?? [];
  return links.map((l) => ({
    id: l.asset.id,
    path: l.asset.path,
    thumbPath: l.asset.thumbPath,
    kind: l.asset.kind as "IMAGE" | "VIDEO",
    label: l.asset.label,
    bytes: l.asset.bytes,
    missing: l.asset.missing,
  }));
}
