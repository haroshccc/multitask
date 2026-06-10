/**
 * Trigger a browser download for an in-memory Blob via a temporary anchor +
 * object URL. The URL is revoked on the next tick so the download has a chance
 * to start before the blob is reclaimed.
 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
