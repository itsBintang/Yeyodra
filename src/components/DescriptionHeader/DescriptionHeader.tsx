import { useTranslation } from "react-i18next";
import type { ShopDetails } from "@/types";
import "./DescriptionHeader.scss";

interface DescriptionHeaderProps {
  shopDetails: ShopDetails;
}

export function DescriptionHeader({ shopDetails }: DescriptionHeaderProps) {
  const { t } = useTranslation("game_details");

  return (
    <div className="description-header">
      <section className="description-header__info">
        <p>
          {t("release_date", {
            date: shopDetails?.release_date?.date || "TBA",
          })}
        </p>

        {Array.isArray(shopDetails.publishers) && shopDetails.publishers.length > 0 && (
          <p>{t("publisher", { publisher: shopDetails.publishers[0] })}</p>
        )}
      </section>
    </div>
  );
}

