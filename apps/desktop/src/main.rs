use gpui::{
    div, prelude::*, px, rgb, size, App, Application, Bounds, Context, EventEmitter,
    Global, SharedString, Window, WindowBounds, WindowOptions,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Serialize, Deserialize, Clone)]
struct ProjectMetadata {
    id: String,
    name: String,
    path: Option<String>,
    last_modified: u64,
    thumbnail: Option<String>,
    settings: ProjectSettings,
}

#[derive(Serialize, Deserialize, Clone)]
struct ProjectSettings {
    canvas_width: u32,
    canvas_height: u32,
    fps: u32,
    audio_sample_rate: u32,
}

#[derive(Clone)]
struct LocalSyncState {
    is_syncing: bool,
    last_backup: Option<u64>,
    pending_changes: u32,
    external_drive_connected: bool,
    external_drive_path: Option<String>,
}

struct AppState {
    projects: Vec<ProjectMetadata>,
    active_project: Option<ProjectMetadata>,
    local_sync: LocalSyncState,
    native_file_path: Option<PathBuf>,
}

impl Global for AppState {}

struct MainWindow {
    title: SharedString,
    active_tab: usize,
}

impl Render for MainWindow {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        let state = AppState::global();

        div()
            .size_full()
            .bg(rgb(0x0a0a0a))
            .flex()
            .flex_col()
            .child(
                div()
                    .w_full()
                    .h(px(48.))
                    .bg(rgb(0x141414))
                    .border_b_1()
                    .border_color(rgb(0x2a2a2a))
                    .flex()
                    .items_center()
                    .px_4()
                    .child(
                        div()
                            .flex()
                            .gap_2()
                            .child(self.tab_button("Projects", 0))
                            .child(self.tab_button("Editor", 1))
                            .child(self.tab_button("Export", 2))
                            .child(self.tab_button("Backup", 3)),
                    )
                    .child(
                        div()
                            .ml_auto()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(
                                div()
                                    .text_sm()
                                    .text_color(rgb(0xa0a0a0))
                                    .child(format!("{} projects", state.projects.len())),
                            ),
                    ),
            )
            .child(
                div()
                    .flex_1()
                    .p_4()
                    .child(match self.active_tab {
                        0 => self.render_projects_tab(),
                        1 => self.render_editor_tab(),
                        2 => self.render_export_tab(),
                        3 => self.render_backup_tab(),
                        _ => div().into_any_element(),
                    }),
            )
    }
}

impl MainWindow {
    fn tab_button(&self, label: &str, index: usize) -> impl Element {
        let is_active = self.active_tab == index;
        div()
            .px_3()
            .py_1()
            .rounded_md()
            .text_sm()
            .text_color(if is_active { rgb(0xffffff) } else { rgb(0xa0a0a0) })
            .bg(if is_active { rgb(0x3b82f6) } else { rgb(0x0a0a0a) })
            .hover(|style| style.bg(rgb(0x2a2a2a)))
            .cursor_pointer()
            .child(label)
    }

    fn render_projects_tab(&self) -> AnyElement {
        let state = AppState::global();
        div()
            .flex()
            .flex_col()
            .gap_4()
            .child(
                div()
                    .text_xl()
                    .text_color(rgb(0xffffff))
                    .child("Recent Projects"),
            )
            .child(
                div()
                    .flex()
                    .flex_wrap()
                    .gap_4()
                    .children(
                        state.projects.iter().map(|project| {
                            div()
                                .w(px(200.))
                                .h(px(150.))
                                .bg(rgb(0x1a1a1a))
                                .border_1()
                                .border_color(rgb(0x2a2a2a))
                                .rounded_lg()
                                .p_3()
                                .flex()
                                .flex_col()
                                .justify_between()
                                .child(
                                    div()
                                        .text_sm()
                                        .text_color(rgb(0xe5e5e5))
                                        .child(&project.name),
                                )
                                .child(
                                    div()
                                        .text_xs()
                                        .text_color(rgb(0x666))
                                        .child(format!("Modified: {}", project.last_modified)),
                                )
                        }),
                    ),
            )
            .into_any_element()
    }

    fn render_editor_tab(&self) -> AnyElement {
        div()
            .flex()
            .items_center()
            .justify_center()
            .size_full()
            .child(
                div()
                    .text_xl()
                    .text_color(rgb(0x666))
                    .child("Select or create a project to start editing"),
            )
            .into_any_element()
    }

    fn render_export_tab(&self) -> AnyElement {
        div()
            .flex()
            .items_center()
            .justify_center()
            .size_full()
            .child(
                div()
                    .text_xl()
                    .text_color(rgb(0x666))
                    .child("Export panel — select format and quality"),
            )
            .into_any_element()
    }

    fn render_backup_tab(&self) -> AnyElement {
        let state = AppState::global();
        div()
            .flex()
            .flex_col()
            .gap_4()
            .child(
                div()
                    .text_xl()
                    .text_color(rgb(0xffffff))
                    .child("Local Backup"),
            )
            .child(
                div()
                    .p_4()
                    .bg(rgb(0x1a1a1a))
                    .rounded_lg()
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_3()
                            .child(
                                div()
                                    .w(px(12.))
                                    .h(px(12.))
                                    .rounded_full()
                                    .bg(if state.local_sync.external_drive_connected {
                                        rgb(0x22c55e)
                                    } else {
                                        rgb(0x666)
                                    }),
                            )
                            .child(
                                div()
                                    .text_sm()
                                    .text_color(rgb(0xe5e5e5))
                                    .child(if state.local_sync.external_drive_connected {
                                        format!("External drive connected: {}",
                                            state.local_sync.external_drive_path.as_deref().unwrap_or("Unknown"))
                                    } else {
                                        "No external drive detected"
                                    }),
                            ),
                    ),
            )
            .child(
                div()
                    .text_sm()
                    .text_color(rgb(0xa0a0a0))
                    .child(format!("Pending changes: {}", state.local_sync.pending_changes)),
            )
            .child(
                div()
                    .text_sm()
                    .text_color(rgb(0xa0a0a0))
                    .child(format!("Last backup: {}",
                        state.local_sync.last_backup.map(|t| t.to_string()).unwrap_or_else(|| "Never".to_string()))),
            )
            .into_any_element()
    }
}

impl MainWindow {
    fn new() -> Self {
        Self {
            title: "StratosCut".into(),
            active_tab: 0,
        }
    }
}

fn init_native_file_system(_cx: &mut App) -> PathBuf {
    let documents = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
    let opencut_dir = documents.join("StratosCut");
    std::fs::create_dir_all(&opencut_dir).ok();
    opencut_dir
}

fn load_projects_from_disk(path: &PathBuf) -> Vec<ProjectMetadata> {
    let mut projects = Vec::new();

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("opencut") {
                if let Ok(contents) = std::fs::read_to_string(&path) {
                    if let Ok(meta) = serde_json::from_str::<ProjectMetadata>(&contents) {
                        projects.push(meta);
                    }
                }
            }
        }
    }

    projects.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));
    projects
}

fn detect_external_drives() -> (bool, Option<String>) {
    #[cfg(target_os = "macos")]
    {
        let volumes = PathBuf::from("/Volumes");
        if let Ok(entries) = std::fs::read_dir(&volumes) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() && path.file_name().map_or(false, |n| n != "Macintosh HD") {
                    return (true, Some(path.to_string_lossy().to_string()));
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let media = PathBuf::from("/media");
        if let Ok(entries) = std::fs::read_dir(&media) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    return (true, Some(path.to_string_lossy().to_string()));
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        for drive in b'A'..=b'Z' {
            let path = format!("{}:\\", drive as char);
            if std::fs::metadata(&path).map_or(false, |m| m.is_dir()) {
                let drive_type = unsafe {
                    use std::ffi::OsStr;
                    use std::os::windows::ffi::OsStrExt;
                    let wide: Vec<u16> = OsStr::new(&path).encode_wide().chain(Some(0)).collect();
                    windows_sys::Win32::Storage::FileSystem::GetDriveTypeW(wide.as_ptr())
                };
                if drive_type == 2 {
                    return (true, Some(path));
                }
            }
        }
    }

    (false, None)
}

async fn backup_to_external_drive(
    projects: &[ProjectMetadata],
    drive_path: &str,
) -> Result<(), String> {
    let backup_dir = PathBuf::from(drive_path).join("StratosCut-Backup");
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    for project in projects {
        if let Some(path) = &project.path {
            let src = PathBuf::from(path);
            let dest = backup_dir.join(src.file_name().unwrap_or_default());
            if src.exists() {
                std::fs::copy(&src, &dest).map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}

fn main() {
    Application::new().run(|cx: &mut App| {
        let native_dir = init_native_file_system(cx);
        let projects = load_projects_from_disk(&native_dir);
        let (drive_connected, drive_path) = detect_external_drives();

        cx.set_global(AppState {
            projects,
            active_project: None,
            local_sync: LocalSyncState {
                is_syncing: false,
                last_backup: None,
                pending_changes: 0,
                external_drive_connected: drive_connected,
                external_drive_path: drive_path,
            },
            native_file_path: Some(native_dir),
        });

        let bounds = Bounds::centered(None, size(px(1440.), px(900.)), cx);
        cx.open_window(
            WindowOptions {
                window_bounds: Some(WindowBounds::Windowed(bounds)),
                window_background: gpui::WindowBackgroundAppearance::Opaque,
                ..Default::default()
            },
            |_, cx| cx.new(|_| MainWindow::new()),
        )
        .unwrap();
        cx.activate(true);
    });
}
