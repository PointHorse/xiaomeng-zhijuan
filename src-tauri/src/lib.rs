//! 小梦织卷 · Tauri 入口（最薄封装）
//!
//! Rust 侧只做三件事：
//! 1. 注册官方插件（SQLite / 对话框 / HTTP 转发）
//! 2. DPAPI 加解密命令包装（API Key 加密存储；实现在 dpapi.rs）
//! 3. Win11 Mica 质感（失败优雅降级）
//!
//! 所有业务逻辑（续写、候选编排、故事树、导出格式、SSE 解析）都在 TypeScript 侧。

mod dpapi;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

/// DPAPI 加密命令：明文 → base64 密文
#[tauri::command]
fn dpapi_protect(plain: String) -> Result<String, String> {
    dpapi::protect(&plain)
}

/// DPAPI 解密命令：base64 密文 → 明文
#[tauri::command]
fn dpapi_reveal(blob_b64: String) -> Result<String, String> {
    dpapi::reveal(&blob_b64)
}

/// 导出文本落盘（路径由前端保存对话框产生）
#[tauri::command]
fn export_text_file(path: String, contents: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("导出路径为空".into());
    }
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_stories",
        sql: "CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                tree_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL
              );",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:xiaomeng.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            dpapi_protect,
            dpapi_reveal,
            export_text_file
        ])
        .setup(|app| {
            // Win11 Mica 质感；失败优雅降级为纯色（不影响功能）
            if let Some(window) = app.get_webview_window("main") {
                let _ = window_vibrancy::apply_mica(&window, None);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("小梦织卷启动失败");
}
