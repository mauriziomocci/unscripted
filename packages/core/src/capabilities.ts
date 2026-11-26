/** Optional capability: read text aloud. A platform without speech simply does not provide it (P-06). */
export interface Speech {
  speak(text: string, voice?: string): void;
  stop(): void;
}

/** Optional capability: hand the user a file to save (P-06). */
export interface Downloads {
  save(fileName: string, content: string, mimeType: string): void;
}
