//! Windows DPAPI 加解密原语：用于 API Key 的加密存储（绝不明文落盘）。
//! 密文绑定当前 Windows 用户账户，换机器/换用户无法解密。
//! 本模块只提供纯函数；Tauri 命令包装见 lib.rs（规避跨模块命令宏可见性问题）。

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{LocalFree, HLOCAL};
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB,
};

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// DPAPI 加密：明文 → base64 密文
pub fn protect(plain: &str) -> Result<String, String> {
    let bytes = plain.as_bytes();
    let in_blob = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut out_blob = CRYPT_INTEGER_BLOB::default();
    let desc = wide("xiaomeng-zhijuan");
    unsafe {
        CryptProtectData(
            &in_blob,
            PCWSTR(desc.as_ptr()),
            None,
            None,
            None,
            0,
            &mut out_blob,
        )
        .map_err(|e| format!("DPAPI 加密失败: {e}"))?;
    }
    let slice = unsafe {
        std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize)
    }
    .to_vec();
    unsafe {
        let _ = LocalFree(HLOCAL(out_blob.pbData.cast()));
    }
    Ok(B64.encode(slice))
}

/// DPAPI 解密：base64 密文 → 明文
pub fn reveal(blob_b64: &str) -> Result<String, String> {
    let bytes = B64
        .decode(blob_b64.as_bytes())
        .map_err(|e| format!("base64 解码失败: {e}"))?;
    let in_blob = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut out_blob = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptUnprotectData(&in_blob, None, None, None, None, 0, &mut out_blob)
            .map_err(|e| format!("DPAPI 解密失败: {e}"))?;
    }
    let slice = unsafe {
        std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize)
    }
    .to_vec();
    unsafe {
        let _ = LocalFree(HLOCAL(out_blob.pbData.cast()));
    }
    String::from_utf8(slice).map_err(|e| format!("UTF-8 转换失败: {e}"))
}
