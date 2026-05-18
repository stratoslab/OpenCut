# Design: B-Roll Suggestions

## Overview

Rule-based transcript analysis identifies visual-worthy moments (proper nouns, action verbs, descriptive phrases). Each suggestion includes keywords for Pexels search. Results displayed as cards with search integration.

## Components

### Component 1: BrollAnalyzer
- **Responsibility:** Analyze transcript for visual-worthy moments using rule-based NLP
- **Interface:** `analyze(transcript: WordTranscript): BrollSuggestion[]`
- **Key design:** Detects proper nouns, action verbs, descriptive phrases, numbers/statistics

### Component 2: BrollSuggestionsPanel
- **Responsibility:** Display suggestion cards, Pexels search results, timeline insertion
- **Interface:** React component in assets panel
- **Dependencies:** Pexels API (client-side fetch), MediaManager

### Component 3: PexelsClient
- **Responsibility:** Search Pexels API for photos/videos matching keywords
- **Interface:** `search(keywords: string, type: "photo" | "video"): Promise<PexelsResult[]>`

## Data Model

```typescript
interface BrollSuggestion {
  timestamp: number;
  duration: number;
  description: string;
  keywords: string[];
  priority: "high" | "medium" | "low";
}
```

## Data Flow

1. Transcript available → BrollAnalyzer scans for proper nouns, action verbs, descriptive phrases
2. Results sorted by priority → displayed as cards in BrollSuggestionsPanel
3. User clicks suggestion → PexelsClient.search(keywords) → results shown
4. User selects asset → inserted as overlay on timeline at the suggested timestamp

## Error Handling

| Situation | Handling |
|-----------|----------|
| Transcript too short (<100 words) | Skip analysis — UI shows "Add more footage for suggestions" |
| Pexels API rate-limited | Cache results, show stale data with "Cached" badge |
| No suggestions found | Show empty state with explanation and refresh button |
| Pexels API returns 0 results | Show "No matching footage found" and offer keyword editing |

## Testing Strategy

- **Unit test:** BrollAnalyzer extracts proper nouns from known transcript patterns
- **Unit test:** BrollAnalyzer returns empty array for transcript with no visual-worthy content
- **Unit test:** PexelsClient handles API errors gracefully
- **Integration test:** Click suggestion → search → insert to timeline
