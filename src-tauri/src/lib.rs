//! DreamCore-revival · Tauri 入口（最薄封装）
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

/// 导出二进制（base64 → 字节）落盘：分享长图 PNG 等用
#[tauri::command]
fn export_base64_file(path: String, contents_b64: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("导出路径为空".into());
    }
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(contents_b64.as_bytes())
        .map_err(|e| format!("base64 解码失败: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| e.to_string())
}

/// 复制 PNG 图片到系统剪贴板（Windows：PowerShell + System.Windows.Forms）
#[tauri::command]
fn copy_image_to_clipboard(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let ps = format!(
            "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('{}'));",
            path.replace("\\", "\\\\").replace("'", "''")
        );
        std::process::Command::new("powershell")
            .args(["-NoProfile", "-STA", "-Command", &ps])
            .output()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    Err("当前平台不支持图片剪贴板复制".into())
}

/// 在资源管理器中打开文件所在文件夹并选中该文件（Windows）
#[tauri::command]
fn open_containing_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", path))
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
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
            export_text_file,
            export_base64_file,
            open_containing_folder,
            copy_image_to_clipboard
        ])
        .setup(|app| {
            // Win11 Mica 质感；非桌面平台或不支持时优雅降级为纯色
            #[cfg(all(windows, not(mobile)))]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window_vibrancy::apply_mica(&window, None);
            }
            let _ = app; // 移动平台占位
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("DreamCore-revival 启动失败");
}
