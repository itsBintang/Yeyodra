import { useEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import { debounce } from "lodash-es";
import {
  GameItem,
  Pagination,
  FilterItem,
  FilterSection,
} from "../components";
import { useAppDispatch, useAppSelector } from "../store";
import { setFilters, setPage } from "../features/catalogueSlice";
import { useCatalogue } from "../hooks";
import { useNetworkMode } from "@/contexts/network-mode";
import type {
  CatalogueSearchResult,
  CatalogueSearchResponse,
} from "../types";
import "./Catalogue.scss";

const PAGE_SIZE_NORMAL = 20;
const PAGE_SIZE_LOW_CONNECTION = 12;

const filterCategoryColors = {
  genres: "hsl(262deg 50% 47%)",
  tags: "hsl(95deg 50% 20%)",
  downloadSourceFingerprints: "hsl(27deg 50% 40%)",
  developers: "hsl(340deg 50% 46%)",
  publishers: "hsl(200deg 50% 30%)",
};

export function Catalogue() {
  const { t, i18n } = useTranslation("catalogue");
  const dispatch = useAppDispatch();
  const { isLowConnectionMode } = useNetworkMode();
  
  const { steamDevelopers, steamPublishers } = useCatalogue();

  const { filters, page, steamGenres, steamUserTags } = useAppSelector(
    (state) => state.catalogue
  );
  
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<CatalogueSearchResult[]>([]);
  const [itemsCount, setItemsCount] = useState(0);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const cataloguePageRef = useRef<HTMLDivElement>(null);

  const language = i18n.language.split("-")[0];
  
  // Adaptive page size based on connection mode
  const PAGE_SIZE = isLowConnectionMode ? PAGE_SIZE_LOW_CONNECTION : PAGE_SIZE_NORMAL;

  const decodeHTML = (s: string) =>
    s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  const debouncedSearch = useRef(
    debounce(async (searchFilters, pageSize, offset) => {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await invoke<CatalogueSearchResponse>(
          "search_catalogue",
          {
            payload: searchFilters,
            take: pageSize,
            skip: offset,
          }
        );

        if (!abortController.signal.aborted) {
          setResults(response.edges);
          setItemsCount(response.count);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to search games:", error);
        if (!abortController.signal.aborted) {
          setResults([]);
          setItemsCount(0);
          setIsLoading(false);
        }
      }
    }, isLowConnectionMode ? 1000 : 500) // Longer debounce in low connection mode
  ).current;


  useEffect(() => {
    setResults([]);
    setIsLoading(true);
    abortControllerRef.current?.abort();

    debouncedSearch(filters, PAGE_SIZE, (page - 1) * PAGE_SIZE);

    return () => {
      debouncedSearch.cancel();
    };
  }, [filters, page, debouncedSearch]);

  const handlePageChange = (newPage: number) => {
    dispatch(setPage(newPage));
    if (cataloguePageRef.current) {
      cataloguePageRef.current.scrollTop = 0;
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  // Steam genres mapping (multi-language support)
  const steamGenresMapping = useMemo<Record<string, string>>(() => {
    // Fallback to English if language not available
    const genresInLanguage = steamGenres[language] || steamGenres["en"];
    if (!genresInLanguage) return {};

    return genresInLanguage.reduce((prev, genre, index) => {
      prev[genre] = steamGenres["en"][index];
      return prev;
    }, {} as Record<string, string>);
  }, [steamGenres, language]);

  // Steam genres filter items
  const steamGenresFilterItems = useMemo(() => {
    return Object.entries(steamGenresMapping)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => ({
        label: key,
        value: value,
        checked: filters.genres.includes(value),
      }));
  }, [steamGenresMapping, filters.genres]);

  // Steam user tags filter items
  const steamUserTagsFilterItems = useMemo(() => {
    // Fallback to English if language not available
    const tagsInLanguage = steamUserTags[language] || steamUserTags["en"];
    if (!tagsInLanguage) return [];

    return Object.entries(tagsInLanguage)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => ({
        label: key,
        value: value,
        checked: filters.tags.includes(value),
      }));
  }, [steamUserTags, filters.tags, language]);

  // Grouped active filters for display as chips
  const groupedFilters = useMemo(() => {
    return [
      ...filters.genres.map((genre) => ({
        label:
          Object.keys(steamGenresMapping).find(
            (key) => steamGenresMapping[key] === genre
          ) || genre,
        orbColor: filterCategoryColors.genres,
        key: "genres" as const,
        value: genre,
      })),

      ...filters.tags.map((tag) => ({
        label:
          Object.keys((steamUserTags[language] || steamUserTags["en"]) || {}).find(
            (key) => (steamUserTags[language] || steamUserTags["en"])[key] === tag
          ) || tag.toString(),
        orbColor: filterCategoryColors.tags,
        key: "tags" as const,
        value: tag,
      })),

      ...filters.developers.map((developer) => ({
        label: developer,
        orbColor: filterCategoryColors.developers,
        key: "developers" as const,
        value: developer,
      })),

      ...filters.publishers.map((publisher) => ({
        label: decodeHTML(publisher),
        orbColor: filterCategoryColors.publishers,
        key: "publishers" as const,
        value: publisher,
      })),
    ];
  }, [filters, steamUserTags, steamGenresMapping, language]);

  // Filter sections for sidebar
  const filterSections = useMemo(() => {
    return [
      {
        title: t("genres"),
        items: steamGenresFilterItems,
        key: "genres" as const,
      },
      {
        title: t("tags"),
        items: steamUserTagsFilterItems,
        key: "tags" as const,
      },
      {
        title: t("developers"),
        items: steamDevelopers.map((developer) => ({
          label: developer,
          value: developer,
          checked: filters.developers.includes(developer),
        })),
        key: "developers" as const,
      },
      {
        title: t("publishers"),
        items: steamPublishers.map((publisher) => ({
          label: decodeHTML(publisher),
          value: publisher,
          checked: filters.publishers.includes(publisher),
        })),
        key: "publishers" as const,
      },
    ];
  }, [
    steamDevelopers,
    filters.developers,
    filters.publishers,
    steamPublishers,
    steamGenresFilterItems,
    steamUserTagsFilterItems,
    t,
  ]);

  return (
    <div className="catalogue" ref={cataloguePageRef}>
      {/* Active Filters Chips */}
      {groupedFilters.length > 0 && (
        <div className="catalogue__filters-wrapper">
          <ul className="catalogue__filters-list">
            {groupedFilters.map((filter) => (
              <li key={`${filter.key}-${filter.value}`}>
                <FilterItem
                  filter={filter.label}
                  orbColor={filter.orbColor}
                  onRemove={() => {
                    dispatch(
                      setFilters({
                        [filter.key]: filters[filter.key].filter(
                          (item) => item !== filter.value
                        ),
                      })
                    );
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="catalogue__content">
        <div className="catalogue__games-container">
          {isLoading ? (
            <SkeletonTheme baseColor="#1c1c1c" highlightColor="#444">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <Skeleton key={i} className="catalogue__skeleton" />
              ))}
            </SkeletonTheme>
          ) : results.length === 0 ? (
            <div className="catalogue__no-results">{t("no_results")}</div>
          ) : (
            results.map((game) => <GameItem key={game.id} game={game} />)
          )}

          {!isLoading && results.length > 0 && (
            <div className="catalogue__pagination-container">
              <span className="catalogue__result-count">
                {t("result_count", {
                  resultCount: formatNumber(itemsCount),
                })}
              </span>

              <Pagination
                page={page}
                totalPages={Math.ceil(itemsCount / PAGE_SIZE)}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>

        {/* Filter Sidebar */}
        <div className="catalogue__filters-container">
          <div className="catalogue__filters-sections">
            {filterSections.map((section) => (
              <FilterSection
                key={section.key}
                title={section.title}
                onClear={() => dispatch(setFilters({ [section.key]: [] }))}
                color={filterCategoryColors[section.key]}
                onSelect={(value) => {
                  // Handle tags (numbers) vs other filters (strings)
                  if (section.key === "tags") {
                    const numValue = value as number;
                    if (filters.tags.includes(numValue)) {
                      dispatch(
                        setFilters({
                          tags: filters.tags.filter((item) => item !== numValue),
                        })
                      );
                    } else {
                      dispatch(
                        setFilters({
                          tags: [...filters.tags, numValue],
                        })
                      );
                    }
                  } else {
                    const strValue = value as string;
                    const key = section.key as "genres" | "developers" | "publishers";
                    if (filters[key].includes(strValue)) {
                      dispatch(
                        setFilters({
                          [key]: filters[key].filter((item) => item !== strValue),
                        })
                      );
                    } else {
                      dispatch(
                        setFilters({
                          [key]: [...filters[key], strValue],
                        })
                      );
                    }
                  }
                }}
                items={section.items}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
