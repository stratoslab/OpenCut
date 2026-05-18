use serde::{Deserialize, Serialize};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

const EPSILON: f64 = 0.000_001;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordSegmentInput {
    pub text: String,
    pub start: f64,
    pub end: f64,
    pub word_index: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WordTranscriptInput {
    pub words: Vec<WordSegmentInput>,
    pub full_text: String,
    pub language: String,
    pub video_duration: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineClipInput {
    pub track_id: String,
    pub clip_id: String,
    pub name: String,
    pub start: f64,
    pub duration: f64,
    pub trim_start: f64,
    pub trim_end: f64,
    pub source_duration: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineContextInput {
    pub clips: Vec<TimelineClipInput>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanSelectionEditInput {
    pub transcript: WordTranscriptInput,
    pub selected_word_indices: Vec<usize>,
    pub timeline: TimelineContextInput,
    pub ripple: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanSuggestionEditInput {
    pub transcript: WordTranscriptInput,
    pub start: f64,
    pub end: f64,
    pub timeline: TimelineContextInput,
    pub ripple: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptDeletedRange {
    pub word_indices: Vec<usize>,
    pub time_range: TimeRange,
    pub deleted_text: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeRange {
    pub start: f64,
    pub end: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptEditPlan {
    pub ranges: Vec<TranscriptDeletedRange>,
    pub cut_plan: TimelineCutPlan,
    pub mode: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineCutPlan {
    pub operations: Vec<TimelineCutOperation>,
    pub affected_clip_ids: Vec<String>,
    pub duration_removed: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineCutOperation {
    pub operation_type: String,
    pub track_id: String,
    pub clip_id: String,
    pub clip_name: String,
    pub source_time_range: TimeRange,
}

pub fn validate_word_transcript_core(transcript: &WordTranscriptInput) -> ValidationResult {
    let mut errors = Vec::new();

    if !transcript.video_duration.is_finite() || transcript.video_duration < 0.0 {
        errors.push("videoDuration must be finite and non-negative".to_string());
    }

    let mut previous_end = 0.0;
    for (position, word) in transcript.words.iter().enumerate() {
        if word.text.trim().is_empty() {
            errors.push(format!("word {position} has empty text"));
        }
        if !word.start.is_finite() || !word.end.is_finite() {
            errors.push(format!("word {position} has non-finite timestamps"));
            continue;
        }
        if word.start < -EPSILON {
            errors.push(format!("word {position} starts before zero"));
        }
        if word.end + EPSILON < word.start {
            errors.push(format!("word {position} ends before it starts"));
        }
        if word.end - transcript.video_duration > EPSILON {
            errors.push(format!("word {position} ends after video duration"));
        }
        if position > 0 && word.start + EPSILON < previous_end {
            errors.push(format!("word {position} overlaps previous word"));
        }
        if word.word_index != position {
            errors.push(format!(
                "word {position} has wordIndex {} instead of {position}",
                word.word_index
            ));
        }
        previous_end = word.end;
    }

    ValidationResult {
        valid: errors.is_empty(),
        errors,
    }
}

pub fn resolve_word_indices_for_time_range_core(
    transcript: &WordTranscriptInput,
    range: &TimeRange,
) -> Vec<usize> {
    transcript
        .words
        .iter()
        .filter(|word| word.start < range.end && word.end > range.start)
        .map(|word| word.word_index)
        .collect()
}

pub fn plan_selection_edit_core(
    input: PlanSelectionEditInput,
) -> Result<TranscriptEditPlan, String> {
    let validation = validate_word_transcript_core(&input.transcript);
    if !validation.valid {
        return Err(validation.errors.join("; "));
    }

    let ranges = selected_indices_to_ranges(&input.transcript, input.selected_word_indices)?;
    let cut_plan = plan_timeline_cuts(&ranges, &input.timeline, input.ripple)?;

    Ok(TranscriptEditPlan {
        ranges,
        cut_plan,
        mode: "manual-selection".to_string(),
    })
}

pub fn plan_suggestion_edit_core(
    input: PlanSuggestionEditInput,
) -> Result<TranscriptEditPlan, String> {
    if !input.start.is_finite()
        || !input.end.is_finite()
        || input.start < 0.0
        || input.end <= input.start
    {
        return Err("suggestion time range is invalid".to_string());
    }
    if input.end - input.transcript.video_duration > EPSILON {
        return Err("suggestion time range exceeds video duration".to_string());
    }

    let selected_word_indices = resolve_word_indices_for_time_range_core(
        &input.transcript,
        &TimeRange {
            start: input.start,
            end: input.end,
        },
    );
    if selected_word_indices.is_empty() {
        return Err("suggestion does not map to transcript words".to_string());
    }

    plan_selection_edit_core(PlanSelectionEditInput {
        transcript: input.transcript,
        selected_word_indices,
        timeline: input.timeline,
        ripple: input.ripple,
    })
    .map(|mut plan| {
        plan.mode = "ai-suggestion".to_string();
        plan
    })
}

fn selected_indices_to_ranges(
    transcript: &WordTranscriptInput,
    selected_word_indices: Vec<usize>,
) -> Result<Vec<TranscriptDeletedRange>, String> {
    let mut indices = selected_word_indices;
    indices.sort_unstable();
    indices.dedup();

    if indices.is_empty() {
        return Err("no transcript words selected".to_string());
    }

    let max_index = transcript.words.len().saturating_sub(1);
    if indices.iter().any(|index| *index > max_index) {
        return Err("selected word index is outside transcript".to_string());
    }

    let mut ranges = Vec::new();
    let mut current = Vec::new();
    for index in indices {
        if current
            .last()
            .map(|last: &usize| index == *last + 1)
            .unwrap_or(true)
        {
            current.push(index);
        } else {
            ranges.push(build_deleted_range(transcript, &current)?);
            current = vec![index];
        }
    }
    if !current.is_empty() {
        ranges.push(build_deleted_range(transcript, &current)?);
    }

    Ok(ranges)
}

fn build_deleted_range(
    transcript: &WordTranscriptInput,
    indices: &[usize],
) -> Result<TranscriptDeletedRange, String> {
    let first_index = *indices
        .first()
        .ok_or_else(|| "empty deleted range".to_string())?;
    let last_index = *indices
        .last()
        .ok_or_else(|| "empty deleted range".to_string())?;
    let first = transcript
        .words
        .get(first_index)
        .ok_or_else(|| "deleted range starts outside transcript".to_string())?;
    let last = transcript
        .words
        .get(last_index)
        .ok_or_else(|| "deleted range ends outside transcript".to_string())?;
    let deleted_text = indices
        .iter()
        .filter_map(|index| transcript.words.get(*index))
        .map(|word| word.text.as_str())
        .collect::<Vec<_>>()
        .join(" ");

    Ok(TranscriptDeletedRange {
        word_indices: indices.to_vec(),
        time_range: TimeRange {
            start: first.start,
            end: last.end,
        },
        deleted_text,
    })
}

fn plan_timeline_cuts(
    ranges: &[TranscriptDeletedRange],
    timeline: &TimelineContextInput,
    ripple: bool,
) -> Result<TimelineCutPlan, String> {
    let mut operations = Vec::new();
    let mut affected_clip_ids = Vec::new();
    let duration_removed = merged_duration(ranges.iter().map(|range| &range.time_range).collect());

    for range in ranges {
        for clip in &timeline.clips {
            if !clip.start.is_finite() || !clip.duration.is_finite() || clip.duration < 0.0 {
                return Err(format!("clip {} has invalid timing", clip.clip_id));
            }
            let clip_start = clip.start;
            let clip_end = clip.start + clip.duration;
            if range.time_range.end <= clip_start || range.time_range.start >= clip_end {
                continue;
            }

            let overlap_start = range.time_range.start.max(clip_start);
            let overlap_end = range.time_range.end.min(clip_end);
            if overlap_end <= overlap_start {
                continue;
            }

            let operation_type =
                if overlap_start <= clip_start + EPSILON && overlap_end >= clip_end - EPSILON {
                    "delete"
                } else if overlap_start <= clip_start + EPSILON {
                    "trim-start"
                } else if overlap_end >= clip_end - EPSILON {
                    "trim-end"
                } else {
                    "split"
                };

            if !affected_clip_ids.contains(&clip.clip_id) {
                affected_clip_ids.push(clip.clip_id.clone());
            }
            operations.push(TimelineCutOperation {
                operation_type: operation_type.to_string(),
                track_id: clip.track_id.clone(),
                clip_id: clip.clip_id.clone(),
                clip_name: clip.name.clone(),
                source_time_range: TimeRange {
                    start: overlap_start,
                    end: overlap_end,
                },
            });
        }
    }

    if operations.is_empty() {
        return Err("selected transcript range does not overlap timeline clips".to_string());
    }

    let _ = ripple;
    Ok(TimelineCutPlan {
        operations,
        affected_clip_ids,
        duration_removed,
    })
}

fn merged_duration(mut ranges: Vec<&TimeRange>) -> f64 {
    ranges.sort_by(|a, b| a.start.total_cmp(&b.start));
    let mut total = 0.0;
    let mut current: Option<TimeRange> = None;

    for range in ranges {
        if let Some(active) = &mut current {
            if range.start <= active.end {
                active.end = active.end.max(range.end);
            } else {
                total += active.end - active.start;
                *active = TimeRange {
                    start: range.start,
                    end: range.end,
                };
            }
        } else {
            current = Some(TimeRange {
                start: range.start,
                end: range.end,
            });
        }
    }

    if let Some(active) = current {
        total += active.end - active.start;
    }

    total.max(0.0)
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = validateWordTranscript)]
pub fn validate_word_transcript(value: JsValue) -> Result<JsValue, JsValue> {
    let transcript: WordTranscriptInput = serde_wasm_bindgen::from_value(value)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    serde_wasm_bindgen::to_value(&validate_word_transcript_core(&transcript))
        .map_err(|error| JsValue::from_str(&error.to_string()))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = resolveWordIndicesForTimeRange)]
pub fn resolve_word_indices_for_time_range(value: JsValue) -> Result<JsValue, JsValue> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Input {
        transcript: WordTranscriptInput,
        start: f64,
        end: f64,
    }

    let input: Input = serde_wasm_bindgen::from_value(value)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let indices = resolve_word_indices_for_time_range_core(
        &input.transcript,
        &TimeRange {
            start: input.start,
            end: input.end,
        },
    );
    serde_wasm_bindgen::to_value(&indices).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = planSelectionTranscriptEdit)]
pub fn plan_selection_transcript_edit(value: JsValue) -> Result<JsValue, JsValue> {
    let input: PlanSelectionEditInput = serde_wasm_bindgen::from_value(value)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let plan = plan_selection_edit_core(input).map_err(|error| JsValue::from_str(&error))?;
    serde_wasm_bindgen::to_value(&plan).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = planSuggestionTranscriptEdit)]
pub fn plan_suggestion_transcript_edit(value: JsValue) -> Result<JsValue, JsValue> {
    let input: PlanSuggestionEditInput = serde_wasm_bindgen::from_value(value)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let plan = plan_suggestion_edit_core(input).map_err(|error| JsValue::from_str(&error))?;
    serde_wasm_bindgen::to_value(&plan).map_err(|error| JsValue::from_str(&error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn transcript() -> WordTranscriptInput {
        WordTranscriptInput {
            words: vec![
                WordSegmentInput {
                    text: "hello".into(),
                    start: 0.0,
                    end: 1.0,
                    word_index: 0,
                },
                WordSegmentInput {
                    text: "world".into(),
                    start: 1.0,
                    end: 2.0,
                    word_index: 1,
                },
                WordSegmentInput {
                    text: "hello".into(),
                    start: 3.0,
                    end: 4.0,
                    word_index: 2,
                },
            ],
            full_text: "hello world hello".into(),
            language: "en".into(),
            video_duration: 5.0,
        }
    }

    #[test]
    fn validates_ordered_transcript() {
        assert!(validate_word_transcript_core(&transcript()).valid);
    }

    #[test]
    fn selection_uses_word_indices_not_text() {
        let plan = plan_selection_edit_core(PlanSelectionEditInput {
            transcript: transcript(),
            selected_word_indices: vec![2],
            timeline: TimelineContextInput {
                clips: vec![TimelineClipInput {
                    track_id: "main".into(),
                    clip_id: "clip".into(),
                    name: "Clip".into(),
                    start: 0.0,
                    duration: 5.0,
                    trim_start: 0.0,
                    trim_end: 0.0,
                    source_duration: Some(5.0),
                }],
            },
            ripple: true,
        })
        .expect("plan");

        assert_eq!(plan.ranges[0].word_indices, vec![2]);
        assert_eq!(plan.ranges[0].time_range.start, 3.0);
    }
}
