export interface Chapter {
  timestamp: number;
  title: string;
}

export interface YouTubeDescription {
  title: string;
  description: string;
  tags: string[];
}

export function formatChapters(chapters: Chapter[]): string {
  if (chapters.length === 0) return "";

  const sorted = [...chapters].sort((a, b) => a.timestamp - b.timestamp);

  return sorted
    .map((chapter) => {
      const timestamp = formatTimestamp(chapter.timestamp);
      return `${timestamp} ${chapter.title}`;
    })
    .join("\n");
}

export function validateChapters(
  chapters: Chapter[],
  duration?: number,
): { valid: boolean; error?: string } {
  if (chapters.length === 0) {
    return { valid: false, error: "No chapters provided" };
  }

  const sorted = [...chapters].sort((a, b) => a.timestamp - b.timestamp);

  if (sorted[0].timestamp !== 0) {
    return { valid: false, error: "First chapter must start at 0:00" };
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].timestamp <= sorted[i - 1].timestamp) {
      return { valid: false, error: "Chapter timestamps must be monotonically increasing" };
    }
  }

  if (duration !== undefined && sorted[sorted.length - 1].timestamp > duration) {
    return { valid: false, error: "Last chapter exceeds video duration" };
  }

  return { valid: true };
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
