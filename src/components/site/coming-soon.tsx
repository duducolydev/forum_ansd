import { getTranslations } from "next-intl/server";

export async function ComingSoon({ title }: { title: string }) {
  const t = await getTranslations("common");

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-24 text-center">
      <h1 className="mb-4">{title}</h1>
      <p>{t("comingSoon")}</p>
    </section>
  );
}
