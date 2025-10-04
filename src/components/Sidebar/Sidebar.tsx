import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import classNames from "classnames";
import { routes } from "./routes";
import { SidebarProfile } from "./SidebarProfile";
import { TextField } from "../TextField/TextField";
import { useLibrary } from "@/hooks";
import type { LibraryGame } from "@/types";
import "./Sidebar.scss";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_INITIAL_WIDTH = 250;
const SIDEBAR_MAX_WIDTH = 450;

const initialSidebarWidth = window.localStorage.getItem("sidebarWidth");

const isGamePlayable = (game: LibraryGame) => Boolean(game.executablePath);

export function Sidebar() {
  const filterRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation("sidebar");
  const navigate = useNavigate();
  const location = useLocation();
  const { library, updateLibrary } = useLibrary();

  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(
    initialSidebarWidth ? Number(initialSidebarWidth) : SIDEBAR_INITIAL_WIDTH
  );
  const [filteredLibrary, setFilteredLibrary] = useState<LibraryGame[]>([]);
  const [showPlayableOnly, setShowPlayableOnly] = useState(false);

  const sidebarRef = useRef<HTMLElement>(null);
  const cursorPos = useRef({ x: 0 });
  const sidebarInitialWidth = useRef(0);

  // Sort library alphabetically
  const sortedLibrary = useMemo(() => {
    return [...library].sort((a, b) => a.title.localeCompare(b.title));
  }, [library]);

  // Load library on mount
  useEffect(() => {
    updateLibrary();
  }, [updateLibrary]);

  useEffect(() => {
    setFilteredLibrary(sortedLibrary);
    if (filterRef.current) {
      filterRef.current.value = "";
    }
  }, [sortedLibrary]);

  const handleFilter: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    setFilteredLibrary(
      sortedLibrary.filter((game) =>
        game.title
          .toLowerCase()
          .includes(event.target.value.toLowerCase())
      )
    );
  };

  const handlePlayButtonClick = () => {
    setShowPlayableOnly(!showPlayableOnly);
  };

  const handleAddGameButtonClick = () => {
    // TODO: Implement add custom game modal
    console.log("Add custom game");
  };

  const handleMouseDown: React.MouseEventHandler<HTMLButtonElement> = (
    event
  ) => {
    setIsResizing(true);
    cursorPos.current.x = event.screenX;
    sidebarInitialWidth.current =
      sidebarRef.current?.clientWidth || SIDEBAR_INITIAL_WIDTH;
  };

  useEffect(() => {
    window.onmousemove = (event: MouseEvent) => {
      if (isResizing) {
        const cursorXDelta = event.screenX - cursorPos.current.x;
        const newWidth = Math.max(
          SIDEBAR_MIN_WIDTH,
          Math.min(
            sidebarInitialWidth.current + cursorXDelta,
            SIDEBAR_MAX_WIDTH
          )
        );

        setSidebarWidth(newWidth);
        window.localStorage.setItem("sidebarWidth", String(newWidth));
      }
    };

    window.onmouseup = () => {
      if (isResizing) setIsResizing(false);
    };

    return () => {
      window.onmouseup = null;
      window.onmousemove = null;
    };
  }, [isResizing]);

  const handleSidebarItemClick = (path: string) => {
    if (path !== location.pathname) {
      navigate(path);
    }
  };

  const handleGameClick = (game: LibraryGame) => {
    const path = `/game/${game.shop}/${game.objectId}`;
    if (path !== location.pathname) {
      navigate(path);
    }
  };

  return (
    <aside
      ref={sidebarRef}
      className={classNames("sidebar", {
        "sidebar--resizing": isResizing,
      })}
      style={{
        width: sidebarWidth,
        minWidth: sidebarWidth,
        maxWidth: sidebarWidth,
      }}
    >
      <div className="sidebar__container">
        <SidebarProfile />

        <div className="sidebar__content">
          <section className="sidebar__section">
            <ul className="sidebar__menu">
              {routes.map(({ nameKey, path, render }) => (
                <li
                  key={nameKey}
                  className={classNames("sidebar__menu-item", {
                    "sidebar__menu-item--active": location.pathname === path,
                  })}
                >
                  <button
                    type="button"
                    className="sidebar__menu-item-button"
                    onClick={() => handleSidebarItemClick(path)}
                  >
                    {render()}
                    <span>{t(nameKey)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="sidebar__section">
            <div className="sidebar__section-header">
              <small className="sidebar__section-title">{t("my_library")}</small>
              <div className="sidebar__section-actions">
                <button
                  type="button"
                  className="sidebar__icon-button"
                  onClick={handleAddGameButtonClick}
                  title={t("add_custom_game_tooltip")}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"></path>
                  </svg>
                </button>
                <button
                  type="button"
                  className={classNames("sidebar__icon-button", {
                    "sidebar__icon-button--active": showPlayableOnly,
                  })}
                  onClick={handlePlayButtonClick}
                  title={t("show_playable_only_tooltip")}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215Z"></path>
                  </svg>
                </button>
              </div>
            </div>

            <TextField
              ref={filterRef}
              placeholder={t("filter")}
              onChange={handleFilter}
              theme="dark"
            />

            <ul className="sidebar__menu">
              {filteredLibrary
                .filter((game) => !showPlayableOnly || isGamePlayable(game))
                .map((game) => (
                  <li
                    key={game.id}
                    className={classNames("sidebar__menu-item", {
                      "sidebar__menu-item--active": 
                        location.pathname === `/game/${game.shop}/${game.objectId}`,
                    })}
                  >
                    <button
                      type="button"
                      className="sidebar__menu-item-button"
                      onClick={() => handleGameClick(game)}
                    >
                      {game.iconUrl && (
                        <img 
                          src={game.iconUrl} 
                          alt={game.title}
                          className="sidebar__game-icon"
                        />
                      )}
                      <span className="sidebar__game-title">{game.title}</span>
                    </button>
                  </li>
                ))}
              {filteredLibrary.length === 0 && sortedLibrary.length > 0 && (
                <li className="sidebar__menu-item sidebar__menu-item--empty">
                  <span className="sidebar__empty-text">
                    {t("no_results")}
                  </span>
                </li>
              )}
              {sortedLibrary.length === 0 && (
                <li className="sidebar__menu-item sidebar__menu-item--empty">
                  <span className="sidebar__empty-text">
                    {t("no_games_in_library")}
                  </span>
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>

      <button
        type="button"
        className="sidebar__handle"
        onMouseDown={handleMouseDown}
      />
    </aside>
  );
}

