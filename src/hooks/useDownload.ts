import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Aria2DownloadStatus, Aria2GlobalStat, Download } from "@/types";

interface UseDownloadReturn {
  downloads: Map<string, Download>;
  activeDownload: Download | null;
  globalStat: Aria2GlobalStat | null;
  startDownload: (url: string, savePath: string, filename?: string, gameInfo?: Partial<Download>) => Promise<string>;
  pauseDownload: (gid: string) => Promise<void>;
  resumeDownload: (gid: string) => Promise<void>;
  cancelDownload: (gid: string) => Promise<void>;
  getDownloadStatus: (gid: string) => Promise<Aria2DownloadStatus>;
  updateDownloadStatus: (gid: string) => Promise<void>;
  isDownloading: boolean;
}

export function useDownload(): UseDownloadReturn {
  const [downloads, setDownloads] = useState<Map<string, Download>>(new Map());
  const [activeDownload, setActiveDownload] = useState<Download | null>(null);
  const [globalStat, setGlobalStat] = useState<Aria2GlobalStat | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start a new download
  const startDownload = useCallback(async (
    url: string,
    savePath: string,
    filename?: string,
    gameInfo?: Partial<Download>
  ): Promise<string> => {
    try {
      const gid = await invoke<string>("start_download", {
        url,
        savePath,
        filename,
      });

      const now = new Date().toISOString();
      const newDownload: Download = {
        shop: gameInfo?.shop || "steam",
        objectId: gameInfo?.objectId || "",
        title: gameInfo?.title || filename || "Unknown",
        uri: url,
        downloadPath: savePath,
        progress: 0,
        status: "active",
        bytesDownloaded: 0,
        fileSize: 0,
        downloadSpeed: 0,
        gid,
        filename,
        createdAt: now,
        updatedAt: now,
      };

      setDownloads((prev) => {
        const updated = new Map(prev);
        updated.set(gid, newDownload);
        return updated;
      });

      setActiveDownload(newDownload);
      setIsDownloading(true);

      return gid;
    } catch (error) {
      console.error("Failed to start download:", error);
      throw error;
    }
  }, []);

  // Pause a download
  const pauseDownload = useCallback(async (gid: string): Promise<void> => {
    try {
      await invoke("pause_download", { gid });
      
      setDownloads((prev) => {
        const updated = new Map(prev);
        const download = updated.get(gid);
        if (download) {
          updated.set(gid, {
            ...download,
            status: "paused",
            updatedAt: new Date().toISOString(),
          });
        }
        return updated;
      });

      if (activeDownload?.gid === gid) {
        setIsDownloading(false);
      }
    } catch (error) {
      console.error("Failed to pause download:", error);
      throw error;
    }
  }, [activeDownload]);

  // Resume a paused download
  const resumeDownload = useCallback(async (gid: string): Promise<void> => {
    try {
      await invoke("resume_download", { gid });
      
      setDownloads((prev) => {
        const updated = new Map(prev);
        const download = updated.get(gid);
        if (download) {
          updated.set(gid, {
            ...download,
            status: "active",
            updatedAt: new Date().toISOString(),
          });
          setActiveDownload(download);
        }
        return updated;
      });

      setIsDownloading(true);
    } catch (error) {
      console.error("Failed to resume download:", error);
      throw error;
    }
  }, []);

  // Cancel/remove a download
  const cancelDownload = useCallback(async (gid: string): Promise<void> => {
    try {
      await invoke("cancel_download", { gid });
      
      setDownloads((prev) => {
        const updated = new Map(prev);
        updated.delete(gid);
        return updated;
      });

      if (activeDownload?.gid === gid) {
        setActiveDownload(null);
        setIsDownloading(false);
      }
    } catch (error) {
      console.error("Failed to cancel download:", error);
      throw error;
    }
  }, [activeDownload]);

  // Get download status from aria2c
  const getDownloadStatus = useCallback(async (gid: string): Promise<Aria2DownloadStatus> => {
    try {
      const status = await invoke<Aria2DownloadStatus>("get_download_status", { gid });
      return status;
    } catch (error) {
      console.error("Failed to get download status:", error);
      throw error;
    }
  }, []);

  // Update download status (internal use)
  const updateDownloadStatus = useCallback(async (gid: string): Promise<void> => {
    try {
      const status = await getDownloadStatus(gid);
      
      setDownloads((prev) => {
        const updated = new Map(prev);
        const download = updated.get(gid);
        
        if (download) {
          const totalLength = parseInt(status.totalLength) || 1;
          const completedLength = parseInt(status.completedLength) || 0;
          const progress = totalLength > 0 ? completedLength / totalLength : 0;

          const updatedDownload: Download = {
            ...download,
            progress,
            bytesDownloaded: completedLength,
            fileSize: totalLength,
            downloadSpeed: parseInt(status.downloadSpeed) || 0,
            status: status.status === "complete" ? "complete" : 
                    status.status === "paused" ? "paused" :
                    status.status === "error" ? "error" : "active",
            updatedAt: new Date().toISOString(),
          };

          updated.set(gid, updatedDownload);

          // Update active download if it's the current one
          if (activeDownload?.gid === gid) {
            setActiveDownload(updatedDownload);
          }

          // If download is complete, mark as not downloading
          if (status.status === "complete") {
            setIsDownloading(false);
          }
        }

        return updated;
      });
    } catch (error) {
      console.error("Failed to update download status:", error);
    }
  }, [activeDownload, getDownloadStatus]);

  // Fetch global statistics
  const fetchGlobalStat = useCallback(async () => {
    try {
      const stat = await invoke<Aria2GlobalStat>("get_global_download_stat");
      setGlobalStat(stat);
    } catch (error) {
      console.error("Failed to get global stat:", error);
    }
  }, []);

  // Auto-update active download status
  useEffect(() => {
    if (activeDownload && activeDownload.status === "active") {
      // Update status every second
      updateIntervalRef.current = setInterval(() => {
        if (activeDownload.gid) {
          updateDownloadStatus(activeDownload.gid);
          fetchGlobalStat();
        }
      }, 1000);

      return () => {
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
          updateIntervalRef.current = null;
        }
      };
    }
  }, [activeDownload, updateDownloadStatus, fetchGlobalStat]);

  return {
    downloads,
    activeDownload,
    globalStat,
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    getDownloadStatus,
    updateDownloadStatus,
    isDownloading,
  };
}

