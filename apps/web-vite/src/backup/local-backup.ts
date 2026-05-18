import type { ProjectTemplate } from "@/templates/template-manager";

export interface LocalBackupConfig {
  externalDrivePath?: string;
  networkSharePath?: string;
  autoBackup: boolean;
  backupIntervalMinutes: number;
  maxBackups: number;
}

export interface BackupEntry {
  id: string;
  projectId: string;
  timestamp: number;
  sizeBytes: number;
  location: string;
  type: "external-drive" | "network-share" | "local-folder";
}

export class LocalBackupService {
  private config: LocalBackupConfig;
  private backups: Map<string, BackupEntry[]> = new Map();

  constructor(config: Partial<LocalBackupConfig> = {}) {
    this.config = {
      autoBackup: false,
      backupIntervalMinutes: 30,
      maxBackups: 10,
      ...config,
    };
  }

  async backupProject(
    project: ProjectTemplate,
    location: string,
    type: BackupEntry["type"],
  ): Promise<BackupEntry> {
    const entry: BackupEntry = {
      id: `backup-${crypto.randomUUID()}`,
      projectId: project.id,
      timestamp: Date.now(),
      sizeBytes: 0,
      location,
      type,
    };

    if (!this.backups.has(project.id)) {
      this.backups.set(project.id, []);
    }

    const projectBackups = this.backups.get(project.id)!;
    projectBackups.push(entry);

    if (projectBackups.length > this.config.maxBackups) {
      projectBackups.shift();
    }

    return entry;
  }

  getBackups(projectId: string): BackupEntry[] {
    return this.backups.get(projectId) ?? [];
  }

  detectExternalDrives(): Array<{ path: string; name: string; freeSpace: number }> {
    const drives: Array<{ path: string; name: string; freeSpace: number }> = [];

    if (typeof navigator !== "undefined" && "getStorageEstimate" in (navigator as any)) {
      return drives;
    }

    return drives;
  }

  async restoreFromBackup(backupId: string): Promise<ProjectTemplate | null> {
    for (const entries of this.backups.values()) {
      const backup = entries.find(b => b.id === backupId);
      if (backup) {
        // Restore logic would load from filesystem
        return null;
      }
    }
    return null;
  }

  updateConfig(config: Partial<LocalBackupConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): LocalBackupConfig {
    return { ...this.config };
  }
}

export const localBackupService = new LocalBackupService();
