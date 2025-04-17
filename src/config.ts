export interface AppConfig {
  docsPath: string;
  backupPath: string;
  useDocsPath: boolean;
  useBackupRepo: boolean;
  canDelete: boolean;
}

export const config: AppConfig = {
  docsPath: import.meta.env.VITE_DOCS_PATH || '\\\\devops\\BulkScan\\DocItIn',
  backupPath:
    import.meta.env.VITE_BACKUP_PATH || '\\\\devops\\BulkScan\\ScanBackupRepo',
  useDocsPath: true,
  useBackupRepo: true,
  canDelete: true,
};

export async function checkPathExists(path: string): Promise<boolean> {
  try {
    // Try to access the directory using the File System Access API
    // This will prompt the user to select a directory if it's not already selected
    const handle = await window.showDirectoryPicker();
    return !!handle;
    // return true;
  } catch (error) {
    console.error('Error checking path:', error);
    return false;
  }
}

// export async function checkPathExists(path: string): Promise<boolean> {
//   try {
//     // For network paths, we'll try to access them directly through the file picker
//     // without using the startIn option
//     await window.showDirectoryPicker();
//     return true;
//   } catch (error) {
//     console.error('Error checking path:', error);
//     return false;
//   }
// }
