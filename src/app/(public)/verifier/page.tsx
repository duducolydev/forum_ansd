import { getTranslations } from "next-intl/server";
import { ComingSoon } from "@/components/site/coming-soon";

export default async function VerifyBadgePage() {
  const t = await getTranslations("nav");
  return <ComingSoon title={t("verifyBadge")} />;
}
