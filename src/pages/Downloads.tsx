import { useTranslation } from "react-i18next";
import { useDownload } from "@/hooks";
import { Download, CompletedDownload } from "@/types";
import { useMemo, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Badge } from "@/components";
import { 
  ArrowDownIcon, 
  TrashIcon,
  PlayIcon,
  ColumnsIcon,
  XCircleIcon
} from "@primer/octicons-react";
import "./Downloads.scss";

function DownloadItem({ download }: { download: Download }) {
  const { pauseDownload, resumeDownload, cancelDownload } = useDownload();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return formatBytes(bytesPerSecond) + "/s";
  };

  const handlePause = () => {
    if (download.gid) {
      pauseDownload(download.gid);
    }
  };

  const handleResume = () => {
    if (download.gid) {
      resumeDownload(download.gid);
    }
  };

  const handleCancel = () => {
    if (download.gid && confirm(`Cancel download for ${download.title}?`)) {
      cancelDownload(download.gid);
    }
  };

  return (
    <div className="download-item">
      <div className="download-item__cover">
        <div className="download-item__cover-placeholder">
          <ArrowDownIcon size={24} />
        </div>
      </div>
      
      <div className="download-item__content">
        <div className="download-item__info">
          <h3 className="download-item__title">{download.title}</h3>
          <div className="download-item__stats">
            <p>{(download.progress * 100).toFixed(1)}%</p>
            <p>
              {formatBytes(download.bytesDownloaded)} / {formatBytes(download.fileSize)}
            </p>
            {download.downloadSpeed && download.downloadSpeed > 0 && (
              <p className="download-item__speed">
                {formatSpeed(download.downloadSpeed)}
              </p>
            )}
          </div>
        </div>

        <div className="download-item__actions">
          {download.status === "active" && (
            <button
              onClick={handlePause}
              className="download-item__action-btn"
              title="Pause"
            >
              <ColumnsIcon />
            </button>
          )}
          {download.status === "paused" && (
            <button
              onClick={handleResume}
              className="download-item__action-btn"
              title="Resume"
            >
              <PlayIcon />
            </button>
          )}
          <button
            onClick={handleCancel}
            className="download-item__action-btn download-item__action-btn--danger"
            title="Cancel"
          >
            <XCircleIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function CompletedDownloadItem({ 
  download, 
  onRemove 
}: { 
  download: CompletedDownload;
  onRemove: (appId: string, downloadType: string) => void;
}) {
  const { t } = useTranslation("downloads");

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="download-item download-item--completed">
      <div className="download-item__cover">
        {download.iconUrl ? (
          <img src={download.iconUrl} alt={download.title} />
        ) : (
          <div className="download-item__cover-placeholder">
            <ArrowDownIcon size={24} />
          </div>
        )}
        <div className="download-item__badge-container">
          <Badge>{download.downloadType}</Badge>
        </div>
      </div>
      
      <div className="download-item__content">
        <div className="download-item__info">
          <h3 className="download-item__title">{download.title}</h3>
          <div className="download-item__stats">
            <p>{t("completed")}</p>
            <p>{formatDate(download.completedAt)}</p>
          </div>
        </div>

        <div className="download-item__actions">
          <button
            onClick={() => onRemove(download.appId, download.downloadType)}
            className="download-item__action-btn download-item__action-btn--danger"
            title={t("delete")}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

function DownloadGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="download-group">
      <div className="download-group__header">
        <h2>{title}</h2>
        <div className="download-group__header-divider" />
        <h3 className="download-group__header-count">{count}</h3>
      </div>
      <div className="download-group__list">{children}</div>
    </div>
  );
}

export function Downloads() {
  const { t } = useTranslation("downloads");
  const { downloads } = useDownload();
  const [completedDownloads, setCompletedDownloads] = useState<CompletedDownload[]>([]);

  useEffect(() => {
    // Load completed downloads
    invoke<CompletedDownload[]>("get_completed_downloads")
      .then((history) => setCompletedDownloads(history))
      .catch((err) => console.error("Failed to load download history:", err));
  }, []);

  const handleRemoveCompleted = async (appId: string, downloadType: string) => {
    try {
      await invoke("remove_completed_download", { appId, downloadType });
      setCompletedDownloads((prev) =>
        prev.filter((d) => !(d.appId === appId && d.downloadType === downloadType))
      );
    } catch (error) {
      console.error("Failed to remove download:", error);
    }
  };

  const downloadsList = useMemo(() => {
    return Array.from(downloads.values());
  }, [downloads]);

  const activeDownloads = useMemo(() => {
    return downloadsList.filter((d) => d.status === "active");
  }, [downloadsList]);

  const queuedDownloads = useMemo(() => {
    return downloadsList.filter((d) => d.status === "queued" || d.status === "paused");
  }, [downloadsList]);

  const ariaCompletedDownloads = useMemo(() => {
    return downloadsList.filter((d) => d.status === "complete");
  }, [downloadsList]);

  const hasDownloads =
    downloadsList.length > 0 || completedDownloads.length > 0;

  return (
    <div className="downloads-page">
      {!hasDownloads ? (
        <div className="downloads-page__empty">
          <div className="downloads-page__empty-icon">
            <ArrowDownIcon size={24} />
          </div>
          <h2>{t("no_downloads_title")}</h2>
          <p>{t("no_downloads_description")}</p>
        </div>
      ) : (
        <div className="downloads-page__content">
          <DownloadGroup
            title={t("download_in_progress")}
            count={activeDownloads.length}
          >
            {activeDownloads.map((download) => (
              <DownloadItem key={download.gid} download={download} />
            ))}
          </DownloadGroup>

          <DownloadGroup
            title={t("queued_downloads")}
            count={queuedDownloads.length}
          >
            {queuedDownloads.map((download) => (
              <DownloadItem key={download.gid} download={download} />
            ))}
          </DownloadGroup>

          <DownloadGroup
            title={t("downloads_completed")}
            count={completedDownloads.length + ariaCompletedDownloads.length}
          >
            {completedDownloads.map((download) => (
              <CompletedDownloadItem
                key={`${download.appId}-${download.downloadType}`}
                download={download}
                onRemove={handleRemoveCompleted}
              />
            ))}
            {ariaCompletedDownloads.map((download) => (
              <DownloadItem key={download.gid} download={download} />
            ))}
          </DownloadGroup>
        </div>
      )}
    </div>
  );
}
