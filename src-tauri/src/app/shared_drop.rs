use super::*;

pub(crate) const SHARED_DROP_WINDOW_LABEL: &str = "shared-drop";
const SHARED_DROP_TRAY_ID: &str = "weekend-tray";
const SHARED_DROP_TRAY_MENU_OPEN_MAIN_ID: &str = "weekend-tray-open-main";
const SHARED_DROP_TRAY_MENU_OPEN_DROP_ID: &str = "weekend-tray-open-drop";
const SHARED_DROP_WINDOW_WIDTH: f64 = 372.0;
const SHARED_DROP_WINDOW_HEIGHT: f64 = 312.0;
const SHARED_DROP_WINDOW_MARGIN: f64 = 10.0;
const SHARED_DROP_WINDOW_OFFSET_Y: f64 = 8.0;

fn fallback_shared_drop_position<R: Runtime>(app: &AppHandle<R>) -> Result<(f64, f64), String> {
    if let Some(monitor) = app
        .primary_monitor()
        .map_err(|error| format!("failed to read primary monitor: {error}"))?
    {
        let x = monitor.position().x as f64 + monitor.size().width as f64
            - SHARED_DROP_WINDOW_WIDTH
            - SHARED_DROP_WINDOW_MARGIN;
        let y = monitor.position().y as f64 + SHARED_DROP_WINDOW_MARGIN + 24.0;
        return Ok((
            x.max(SHARED_DROP_WINDOW_MARGIN),
            y.max(SHARED_DROP_WINDOW_MARGIN),
        ));
    }

    Ok((SHARED_DROP_WINDOW_MARGIN, SHARED_DROP_WINDOW_MARGIN))
}

fn shared_drop_window_position_from_rect<R: Runtime>(
    app: &AppHandle<R>,
    rect: tauri::Rect,
) -> Result<(f64, f64), String> {
    let rect_position = rect.position.to_physical::<f64>(1.0);
    let rect_size = rect.size.to_physical::<f64>(1.0);
    let center_x = rect_position.x + rect_size.width / 2.0;
    let mut x = center_x - SHARED_DROP_WINDOW_WIDTH / 2.0;
    let mut y = rect_position.y + rect_size.height + SHARED_DROP_WINDOW_OFFSET_Y;

    if let Some(monitor) = app
        .monitor_from_point(center_x, rect_position.y)
        .map_err(|error| format!("failed to resolve tray monitor: {error}"))?
        .or_else(|| app.primary_monitor().ok().flatten())
    {
        let min_x = monitor.position().x as f64 + SHARED_DROP_WINDOW_MARGIN;
        let max_x = monitor.position().x as f64 + monitor.size().width as f64
            - SHARED_DROP_WINDOW_WIDTH
            - SHARED_DROP_WINDOW_MARGIN;
        if max_x >= min_x {
            x = x.clamp(min_x, max_x);
        } else {
            x = min_x;
        }

        let min_y = monitor.position().y as f64 + SHARED_DROP_WINDOW_MARGIN;
        let max_y = monitor.position().y as f64 + monitor.size().height as f64
            - SHARED_DROP_WINDOW_HEIGHT
            - SHARED_DROP_WINDOW_MARGIN;
        if max_y >= min_y {
            y = y.clamp(min_y, max_y);
        } else {
            y = min_y;
        }
    }

    Ok((x, y))
}

fn position_shared_drop_window<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
    anchor_rect: Option<tauri::Rect>,
) -> Result<(), String> {
    let (x, y) = match anchor_rect {
        Some(rect) => shared_drop_window_position_from_rect(app, rect)?,
        None => fallback_shared_drop_position(app)?,
    };

    window
        .set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))
        .map_err(|error| format!("failed to position shared-drop window: {error}"))
}

fn ensure_shared_drop_window<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, String> {
    if let Some(window) = app.get_webview_window(SHARED_DROP_WINDOW_LABEL) {
        window
            .set_shadow(false)
            .map_err(|error| format!("failed to disable shared-drop window shadow: {error}"))?;
        return Ok(window);
    }

    WebviewWindow::builder(
        app,
        SHARED_DROP_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("Weekend Shared Files")
    .inner_size(SHARED_DROP_WINDOW_WIDTH, SHARED_DROP_WINDOW_HEIGHT)
    .visible(false)
    .focused(false)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .closable(true)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible_on_all_workspaces(true)
    .accept_first_mouse(true)
    .shadow(false)
    .initialization_script(crate::js::shared_drop_init())
    .build()
    .map_err(|error| format!("failed to create shared-drop window: {error}"))
}

fn show_shared_drop_window<R: Runtime>(
    app: &AppHandle<R>,
    anchor_rect: Option<tauri::Rect>,
) -> Result<(), String> {
    let window = ensure_shared_drop_window(app)?;
    position_shared_drop_window(app, &window, anchor_rect)?;
    window
        .show()
        .map_err(|error| format!("failed to show shared-drop window: {error}"))?;
    window
        .set_focus()
        .map_err(|error| format!("failed to focus shared-drop window: {error}"))?;
    Ok(())
}

fn toggle_shared_drop_window<R: Runtime>(
    app: &AppHandle<R>,
    anchor_rect: Option<tauri::Rect>,
) -> Result<(), String> {
    let window = ensure_shared_drop_window(app)?;
    if window.is_visible().unwrap_or(false) {
        window
            .hide()
            .map_err(|error| format!("failed to hide shared-drop window: {error}"))?;
        return Ok(());
    }
    show_shared_drop_window(app, anchor_rect)
}

fn show_shared_drop_window_from_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let anchor_rect = app
        .tray_by_id(SHARED_DROP_TRAY_ID)
        .and_then(|tray| tray.rect().ok().flatten());
    show_shared_drop_window(app, anchor_rect)
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };

    window
        .show()
        .map_err(|error| format!("failed to show main window: {error}"))?;
    let _ = window.unminimize();
    window
        .set_focus()
        .map_err(|error| format!("failed to focus main window: {error}"))
}

#[cfg(target_os = "macos")]
// Keep these in sync with `src-tauri/tauri.conf.json` `trafficLightPosition`.
const MAIN_WINDOW_TRAFFIC_LIGHT_POSITION_X: f64 = 11.0;

#[cfg(target_os = "macos")]
const MAIN_WINDOW_TRAFFIC_LIGHT_POSITION_Y: f64 = 24.0;

#[cfg(target_os = "macos")]
fn set_main_window_standard_buttons_hidden(ns_window: &NSWindow, hidden: bool) {
    // Hide the container view rather than individual buttons so that macOS's
    // NSThemeFrame layout engine cannot restore them during layout passes
    // (which happen during the sidebar width animation).
    if let Some(close) = ns_window.standardWindowButton(NSWindowButton::CloseButton) {
        if let Some(container) = unsafe { close.superview() } {
            container.setHidden(hidden);
        }
    }

    ns_window.displayIfNeeded();
}

#[cfg(target_os = "macos")]
fn restore_main_window_traffic_light_inset(ns_window: &NSWindow) {
    let Some(close) = ns_window.standardWindowButton(NSWindowButton::CloseButton) else {
        return;
    };
    let Some(miniaturize) = ns_window.standardWindowButton(NSWindowButton::MiniaturizeButton)
    else {
        return;
    };
    let Some(zoom) = ns_window.standardWindowButton(NSWindowButton::ZoomButton) else {
        return;
    };
    let Some(close_button_container_view) = (unsafe { close.superview() }) else {
        return;
    };
    let Some(title_bar_container_view) = (unsafe { close_button_container_view.superview() })
    else {
        return;
    };

    let close_rect = NSView::frame(&close);
    let title_bar_frame_height = close_rect.size.height + MAIN_WINDOW_TRAFFIC_LIGHT_POSITION_Y;
    let mut title_bar_rect = NSView::frame(&title_bar_container_view);
    title_bar_rect.size.height = title_bar_frame_height;
    title_bar_rect.origin.y = ns_window.frame().size.height - title_bar_frame_height;
    title_bar_container_view.setFrame(title_bar_rect);

    let space_between = NSView::frame(&miniaturize).origin.x - close_rect.origin.x;
    for (index, button) in [&close, &miniaturize, &zoom].into_iter().enumerate() {
        let mut rect = NSView::frame(button);
        rect.origin.x = MAIN_WINDOW_TRAFFIC_LIGHT_POSITION_X + (index as f64 * space_between);
        button.setFrameOrigin(rect.origin);
        button.setHidden(false);
    }

    title_bar_container_view.setNeedsDisplay(true);
    title_bar_container_view.displayIfNeeded();
    ns_window.displayIfNeeded();
}

#[cfg(target_os = "macos")]
fn set_main_window_traffic_lights_visible<R: Runtime>(
    app: &AppHandle<R>,
    visible: bool,
) -> Result<(), String> {
    let app_handle = app.clone();
    let (tx, rx) = std::sync::mpsc::channel();

    app.run_on_main_thread(move || {
        let result = (|| -> Result<(), String> {
            let window = app_handle
                .get_webview_window("main")
                .ok_or_else(|| "main window not found".to_string())?;
            let ns_window = window
                .ns_window()
                .map_err(|error| format!("failed to access macOS window: {error}"))?;
            let ns_window: &NSWindow = unsafe { &*ns_window.cast() };

            if visible {
                restore_main_window_traffic_light_inset(ns_window);
            } else {
                set_main_window_standard_buttons_hidden(ns_window, true);
            }

            Ok(())
        })();

        let _ = tx.send(result);
    })
    .map_err(|error| format!("failed to schedule traffic light update: {error}"))?;

    rx.recv()
        .map_err(|_| "failed to receive traffic light update result".to_string())?
}

#[cfg(not(target_os = "macos"))]
fn set_main_window_traffic_lights_visible<R: Runtime>(
    _app: &AppHandle<R>,
    _visible: bool,
) -> Result<(), String> {
    Ok(())
}

fn set_tray_icon_pixel(rgba: &mut [u8], width: u32, x: i32, y: i32) {
    if x < 0 || y < 0 {
        return;
    }
    let x = x as u32;
    let y = y as u32;
    if x >= width {
        return;
    }
    let height = rgba.len() as u32 / 4 / width;
    if y >= height {
        return;
    }
    let index = ((y * width + x) * 4) as usize;
    rgba[index] = 0;
    rgba[index + 1] = 0;
    rgba[index + 2] = 0;
    rgba[index + 3] = 255;
}

fn stamp_tray_icon_pixel(rgba: &mut [u8], width: u32, x: i32, y: i32, radius: i32) {
    for offset_x in -radius..=radius {
        for offset_y in -radius..=radius {
            set_tray_icon_pixel(rgba, width, x + offset_x, y + offset_y);
        }
    }
}

fn draw_tray_icon_line(
    rgba: &mut [u8],
    width: u32,
    x0: i32,
    y0: i32,
    x1: i32,
    y1: i32,
    thickness: i32,
) {
    let mut x = x0;
    let mut y = y0;
    let dx = (x1 - x0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let dy = -(y1 - y0).abs();
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx + dy;

    loop {
        stamp_tray_icon_pixel(rgba, width, x, y, thickness);

        if x == x1 && y == y1 {
            break;
        }

        let err2 = err * 2;
        if err2 >= dy {
            err += dy;
            x += sx;
        }
        if err2 <= dx {
            err += dx;
            y += sy;
        }
    }
}

fn weekend_tray_icon() -> Image<'static> {
    const WIDTH: u32 = 18;
    const HEIGHT: u32 = 18;
    let mut rgba = vec![0u8; (WIDTH * HEIGHT * 4) as usize];

    draw_tray_icon_line(&mut rgba, WIDTH, 9, 3, 9, 10, 1);
    draw_tray_icon_line(&mut rgba, WIDTH, 6, 7, 9, 10, 1);
    draw_tray_icon_line(&mut rgba, WIDTH, 12, 7, 9, 10, 1);
    draw_tray_icon_line(&mut rgba, WIDTH, 4, 12, 6, 14, 1);
    draw_tray_icon_line(&mut rgba, WIDTH, 14, 12, 12, 14, 1);
    draw_tray_icon_line(&mut rgba, WIDTH, 6, 14, 12, 14, 1);
    draw_tray_icon_line(&mut rgba, WIDTH, 4, 12, 14, 12, 1);

    Image::new_owned(rgba, WIDTH, HEIGHT)
}

pub(crate) fn install_shared_drop_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let open_main_item = MenuItem::with_id(
        app,
        SHARED_DROP_TRAY_MENU_OPEN_MAIN_ID,
        "Open Weekend",
        true,
        None::<&str>,
    )
    .map_err(|error| format!("failed to create tray menu item: {error}"))?;
    let open_drop_item = MenuItem::with_id(
        app,
        SHARED_DROP_TRAY_MENU_OPEN_DROP_ID,
        "Shared Files",
        true,
        None::<&str>,
    )
    .map_err(|error| format!("failed to create tray menu item: {error}"))?;
    let quit_item = PredefinedMenuItem::quit(app, None)
        .map_err(|error| format!("failed to create tray quit item: {error}"))?;
    let menu = Menu::with_items(app, &[&open_main_item, &open_drop_item, &quit_item])
        .map_err(|error| format!("failed to create tray menu: {error}"))?;

    let tray_icon = TrayIconBuilder::with_id(SHARED_DROP_TRAY_ID)
        .menu(&menu)
        .icon(weekend_tray_icon())
        .icon_as_template(true)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            if event.id() == SHARED_DROP_TRAY_MENU_OPEN_MAIN_ID {
                if let Err(error) = show_main_window(app) {
                    log_backend("WARN", format!("tray open main failed: {error}"));
                }
            } else if event.id() == SHARED_DROP_TRAY_MENU_OPEN_DROP_ID {
                if let Err(error) = show_shared_drop_window_from_tray(app) {
                    log_backend("WARN", format!("tray open shared drop failed: {error}"));
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                if let Err(error) = toggle_shared_drop_window(tray.app_handle(), Some(rect)) {
                    log_backend("WARN", format!("tray toggle shared drop failed: {error}"));
                }
            }
        })
        .build(app)
        .map_err(|error| format!("failed to build tray icon: {error}"))?;

    tray_icon
        .set_icon_as_template(true)
        .map_err(|error| format!("failed to configure tray icon template mode: {error}"))?;

    Ok(())
}

#[tauri::command]
pub(crate) fn set_traffic_lights_visible<R: Runtime>(
    app: AppHandle<R>,
    visible: bool,
) -> Result<(), String> {
    set_main_window_traffic_lights_visible(&app, visible)
}
