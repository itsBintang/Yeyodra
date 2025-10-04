import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import classNames from "classnames";
import { routes } from "./routes";
import { SidebarProfile } from "./SidebarProfile";
import { useLibrary } from "@/hooks";
import type { LibraryGame } from "@/types";
import "./Sidebar.scss";

const SIDEBAR_MIN_WIDTH = 200;
const SIDEBAR_INITIAL_WIDTH = 250;
const SIDEBAR_MAX_WIDTH = 450;

const initialSidebarWidth = window.localStorage.getItem("sidebarWidth");

export function Sidebar() {
  const { t } = useTranslation("sidebar");
  const navigate = useNavigate();
  const location = useLocation();
  const { library, updateLibrary } = useLibrary();

  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(
    initialSidebarWidth ? Number(initialSidebarWidth) : SIDEBAR_INITIAL_WIDTH
  );

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
            <small className="sidebar__section-title">{t("my_library")}</small>
            <ul className="sidebar__menu">
              {sortedLibrary.map((game) => (
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

