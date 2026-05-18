# Design: Subtitle Style Editor

## Overview

A React component with a preset gallery, custom style controls panel, and live preview canvas. Style properties are stored as a `SubtitleStyle` object applied during subtitle rendering. Animations are CSS/Canvas-based effects synchronized with word timestamps.

## Components

### Component 1: SubtitleStyle Type
```typescript
interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  outlineColor: string;
  outlineWidth: number;
  position: { x: number; y: number };
  animation: "none" | "fade" | "slide" | "typewriter" | "bounce" | "karaoke";
  animationDuration: number;
}
```

### Component 2: StyleEditorPanel
- **Responsibility:** Preset gallery, custom controls (font, color, position, animation), live preview
- **Interface:** React component in assets panel
- **Dependencies:** Existing subtitle rendering pipeline

### Component 3: AnimationRenderer
- **Responsibility:** Apply animations to subtitle text during rendering
- **Interface:** `render(text, style, progress): CanvasDrawFn`
- **Key design:** Each animation is a function that transforms text rendering based on progress (0-1)

## Data Flow

1. User opens style editor → current style loaded
2. User selects preset or adjusts controls → style object updates
3. Live preview re-renders with new style
4. On export/playback → style applied to all subtitle rendering

## Error Handling

| Situation | Handling |
|-----------|----------|
| Font fails to load (custom Google Font) | Fall back to system sans-serif |
| Animation duration > subtitle duration | Clamp to subtitle duration |
| User sets font size larger than canvas | Clamp to 80% of canvas height |

## Testing Strategy

- **Unit test:** All presets produce valid SubtitleStyle objects
- **Unit test:** AnimationRenderer produces correct output for each animation type
- **Unit test:** Style changes reflect in live preview within 100ms
- **Property-based test:** For any valid SubtitleStyle, rendering SHALL not throw and SHALL produce a non-empty canvas
