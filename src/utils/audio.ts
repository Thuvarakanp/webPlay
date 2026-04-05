export const AUDIO_EXTS = new Set([
  'mp3', 'wav', 'flac', 'ogg', 'oga', 'aac',
  'm4a', 'opus', 'aiff', 'aif', 'wma', 'webm', 'mp4', 'caf',
]);

export function isAudioFile(f: File): boolean {
  const ext = (f.name.split('.').pop() ?? '').toLowerCase();
  return /^audio\//i.test(f.type) || AUDIO_EXTS.has(ext);
}

export async function extractFilesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const promises: Promise<File[]>[] = [];

  async function readEntry(entry: FileSystemEntry): Promise<File[]> {
    if (!entry) return [];
    if (entry.isFile) {
      return new Promise((resolve) =>
        (entry as FileSystemFileEntry).file(
          (f) => resolve([f]),
          () => resolve([]),
        ),
      );
    } else if (entry.isDirectory) {
      return new Promise((resolve) => {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        let allFiles: File[] = [];
        const readChunk = () => {
          reader.readEntries(async (subEntries) => {
            if (subEntries.length === 0) return resolve(allFiles);
            for (const sub of subEntries) {
              const files = await readEntry(sub);
              allFiles = allFiles.concat(files);
            }
            readChunk();
          }, () => resolve(allFiles));
        };
        readChunk();
      });
    }
    return [];
  }

  if (dt.items) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          promises.push(readEntry(entry));
        } else {
          const f = item.getAsFile();
          if (f) promises.push(Promise.resolve([f]));
        }
      }
    }
    const results = await Promise.all(promises);
    return results.flat().filter(Boolean);
  }

  return Array.from(dt.files);
}
