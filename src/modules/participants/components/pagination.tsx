import Link from "next/link";

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="text-text-3 mt-3 flex items-center justify-between text-sm">
      <span>
        Page {page} / {totalPages} — {total} résultat{total > 1 ? "s" : ""}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={hrefFor(page - 1)} className="border-border rounded-lg border px-3 py-1.5">
            Précédent
          </Link>
        )}
        {page < totalPages && (
          <Link href={hrefFor(page + 1)} className="border-border rounded-lg border px-3 py-1.5">
            Suivant
          </Link>
        )}
      </div>
    </div>
  );
}
