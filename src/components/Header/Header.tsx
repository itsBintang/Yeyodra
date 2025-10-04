import { useTranslation } from "react-i18next";
import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, SearchIcon, XIcon } from "@primer/octicons-react";
import classNames from "classnames";
import { useAppSelector, useAppDispatch } from "@/hooks";
import { setFilters } from "@/features/catalogueSlice";
import "./Header.scss";

const pathTitle: Record<string, string> = {
  "/": "home",
  "/catalogue": "catalogue",
  "/downloads": "downloads",
  "/settings": "settings",
};

export function Header() {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { t } = useTranslation("header");

  const headerTitle = useAppSelector((state) => state.app.headerTitle);
  const searchValue = useAppSelector((state) => state.catalogue.filters.title);

  const [isFocused, setIsFocused] = useState(false);

  const title = useMemo(() => {
    if (location.pathname.startsWith("/game")) return headerTitle || "Game Details";
    if (location.pathname.startsWith("/profile")) return headerTitle || "Profile";
    if (location.pathname.startsWith("/search")) return t("search_results");

    return t(pathTitle[location.pathname]);
  }, [location.pathname, headerTitle, t]);

  const focusInput = () => {
    setIsFocused(true);
    inputRef.current?.focus();
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleBackButtonClick = () => {
    navigate(-1);
  };

  const handleSearch = (value: string) => {
    dispatch(setFilters({ title: value }));

    if (value && !location.pathname.startsWith("/catalogue")) {
      navigate("/catalogue");
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  // Clear search when leaving catalogue page
  // useEffect(() => {
  //   if (!location.pathname.startsWith("/catalogue") && searchValue) {
  //     dispatch(setFilters({ title: "" }));
  //   }
  // }, [location.pathname, searchValue, dispatch]);

  return (
    <header className={classNames("header", "header--is-windows")}>
      <section className="header__section header__section--left">
        <button
          type="button"
          className={classNames("header__back-button", {
            "header__back-button--enabled": location.key !== "default",
          })}
          onClick={handleBackButtonClick}
          disabled={location.key === "default"}
        >
          <ArrowLeftIcon />
        </button>

        <h3
          className={classNames("header__title", {
            "header__title--has-back-button": location.key !== "default",
          })}
        >
          {title}
        </h3>
      </section>

      <section className="header__section">
        <div
          className={classNames("header__search", {
            "header__search--focused": isFocused,
          })}
        >
          <button
            type="button"
            className="header__action-button"
            onClick={focusInput}
          >
            <SearchIcon />
          </button>

          <input
            ref={inputRef}
            type="text"
            name="search"
            placeholder={t("search")}
            value={searchValue}
            className="header__search-input"
            onChange={(event) => handleSearch(event.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />

          {searchValue && (
            <button
              type="button"
              onClick={() => dispatch(setFilters({ title: "" }))}
              className="header__action-button"
            >
              <XIcon />
            </button>
          )}
        </div>
      </section>
    </header>
  );
}

