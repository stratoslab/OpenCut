import { describe, it, expect } from "bun:test";
import { formatChapters, validateChapters, type Chapter } from "../chapter-exporter";

function generateRandomChapters(count: number, maxDuration: number): Chapter[] {
  const chapters: Chapter[] = [];
  let currentTime = 0;

  for (let i = 0; i < count; i++) {
    chapters.push({
      timestamp: currentTime,
      title: `Chapter ${i + 1}`,
    });
    currentTime += 10 + Math.floor(Math.random() * 60);
  }

  return chapters;
}

describe("ChapterExporter (Req 3.1-3.5)", () => {
  it("Property: Output matches MM:SS format", () => {
    for (let run = 0; run < 200; run++) {
      const chapters = generateRandomChapters(3 + Math.floor(Math.random() * 10), 300);
      chapters[0].timestamp = 0;

      const output = formatChapters(chapters);
      const lines = output.split("\n");

      for (const line of lines) {
        expect(line).toMatch(/^\d{1,2}:\d{2} .+$/);
      }
    }
  });

  it("Property: First chapter always at 0:00", () => {
    for (let run = 0; run < 100; run++) {
      const chapters = generateRandomChapters(2 + Math.floor(Math.random() * 5), 300);
      chapters[0].timestamp = 0;

      const output = formatChapters(chapters);
      const firstLine = output.split("\n")[0];

      expect(firstLine.startsWith("0:00")).toBe(true);
    }
  });

  it("Property: Timestamps are monotonic in output", () => {
    for (let run = 0; run < 200; run++) {
      const chapters = generateRandomChapters(3 + Math.floor(Math.random() * 10), 300);
      chapters[0].timestamp = 0;

      const output = formatChapters(chapters);
      const lines = output.split("\n");

      for (let i = 1; i < lines.length; i++) {
        const prevTime = parseTimestamp(lines[i - 1].split(" ")[0]);
        const currTime = parseTimestamp(lines[i].split(" ")[0]);
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    }
  });

  it("Property: Timestamps do not exceed duration", () => {
    for (let run = 0; run < 100; run++) {
      const duration = 60 + Math.floor(Math.random() * 240);
      const chapters = generateRandomChapters(3 + Math.floor(Math.random() * 5), duration);
      chapters[0].timestamp = 0;

      const validation = validateChapters(chapters, duration);

      const lastChapter = chapters[chapters.length - 1];
      if (lastChapter.timestamp <= duration) {
        expect(validation.valid).toBe(true);
      } else {
        expect(validation.valid).toBe(false);
      }
    }
  });

  it("validates empty chapters", () => {
    const result = validateChapters([]);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("validates first chapter not at 0", () => {
    const chapters: Chapter[] = [
      { timestamp: 10, title: "First" },
      { timestamp: 20, title: "Second" },
    ];

    const result = validateChapters(chapters);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("0:00");
  });

  it("validates duplicate timestamps", () => {
    const chapters: Chapter[] = [
      { timestamp: 0, title: "First" },
      { timestamp: 30, title: "Second" },
      { timestamp: 30, title: "Third" },
    ];

    const result = validateChapters(chapters);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("monotonically");
  });

  it("formats single chapter correctly", () => {
    const chapters: Chapter[] = [{ timestamp: 0, title: "Intro" }];
    const output = formatChapters(chapters);
    expect(output).toBe("0:00 Intro");
  });

  it("formats multiple chapters with correct spacing", () => {
    const chapters: Chapter[] = [
      { timestamp: 0, title: "Intro" },
      { timestamp: 65, title: "Main Content" },
      { timestamp: 180, title: "Conclusion" },
    ];

    const output = formatChapters(chapters);
    expect(output).toBe("0:00 Intro\n1:05 Main Content\n3:00 Conclusion");
  });
});

function parseTimestamp(timestamp: string): number {
  const [mins, secs] = timestamp.split(":").map(Number);
  return mins * 60 + secs;
}
