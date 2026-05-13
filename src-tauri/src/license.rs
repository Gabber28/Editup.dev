use aes_gcm::aead::{Aead, AeadCore, OsRng};
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use chrono::{DateTime, Utc};
use hkdf::Hkdf;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::fs;
use std::path::PathBuf;

const HKDF_SALT: &[u8] = b"editup-license-v1";
const NONCE_LEN: usize = 12;
const LEMON_SQUEEZY_URL: &str = "https://api.lemonsqueezy.com/v1/licenses/validate";
const GRACE_PERIOD_DAYS: i64 = 7;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LicenseStatus {
    pub valid: bool,
    pub plan: String,
    pub grace_remaining_days: Option<i64>,
    pub last_verified: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct StoredLicense {
    key: String,
    plan: String,
    last_verified: String,
}

/// Returns the path to `~/.editup/license`.
fn license_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("cannot determine home directory")?;
    Ok(home.join(".editup").join("license"))
}

/// Ensures `~/.editup/` exists with restricted permissions (0o700 on unix).
fn ensure_editup_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("cannot determine home directory")?;
    let dir = home.join(".editup");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("mkdir failed: {e}"))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&dir, fs::Permissions::from_mode(0o700))
                .map_err(|e| format!("chmod failed: {e}"))?;
        }
    }
    Ok(dir)
}

/// Derives AES-256 key from machine-id via HKDF-SHA256.
fn derive_key() -> Result<[u8; 32], String> {
    let machine_id = machine_uid::get().map_err(|e| format!("machine-id error: {e}"))?;
    let hk = Hkdf::<Sha256>::new(Some(HKDF_SALT), machine_id.as_bytes());
    let mut key = [0u8; 32];
    hk.expand(b"editup-aes-key", &mut key).map_err(|e| format!("hkdf expand: {e}"))?;
    Ok(key)
}

/// Encrypts data with AES-256-GCM, returns base64(nonce || ciphertext).
fn encrypt(plaintext: &[u8]) -> Result<String, String> {
    let key = derive_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("cipher init: {e}"))?;
    let nonce_bytes = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce_bytes, plaintext)
        .map_err(|e| format!("encrypt error: {e}"))?;
    let mut out = nonce_bytes.to_vec();
    out.extend(ciphertext);
    Ok(B64.encode(out))
}

/// Decrypts base64(nonce || ciphertext) with AES-256-GCM.
fn decrypt(encoded: &str) -> Result<Vec<u8>, String> {
    let raw = B64.decode(encoded).map_err(|e| format!("b64 decode: {e}"))?;
    if raw.len() < NONCE_LEN + 16 {
        return Err("ciphertext too short".into());
    }
    let key = derive_key()?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("cipher init: {e}"))?;
    let nonce = Nonce::from_slice(&raw[..NONCE_LEN]);
    cipher
        .decrypt(nonce, &raw[NONCE_LEN..])
        .map_err(|e| format!("decrypt error: {e}"))
}

/// Saves an encrypted license to disk after online verification.
pub async fn save_key(key: &str) -> Result<LicenseStatus, String> {
    let status = verify_online(key).await?;
    let stored = StoredLicense {
        key: key.to_string(), plan: status.plan.clone(),
        last_verified: status.last_verified.clone(),
    };
    let json = serde_json::to_vec(&stored).map_err(|e| format!("serialize: {e}"))?;
    ensure_editup_dir()?;
    fs::write(license_path()?, encrypt(&json)?).map_err(|e| format!("write: {e}"))?;
    Ok(status)
}

/// Loads the current license status from disk (offline-capable).
pub fn load_status() -> Result<LicenseStatus, String> {
    let path = license_path()?;
    if !path.exists() {
        return Ok(LicenseStatus {
            valid: true,
            plan: "tester".into(),
            grace_remaining_days: None,
            last_verified: Utc::now().to_rfc3339(),
        });
    }
    let encoded = fs::read_to_string(&path)
        .map_err(|e| format!("read license: {e}"))?;
    let plain = decrypt(&encoded)?;
    let stored: StoredLicense = serde_json::from_slice(&plain)
        .map_err(|e| format!("deserialize license: {e}"))?;
    let grace = grace_remaining_days(&stored.last_verified)?;
    let valid = grace.map_or(true, |d| d >= 0);
    Ok(LicenseStatus {
        valid,
        plan: stored.plan,
        grace_remaining_days: grace,
        last_verified: stored.last_verified,
    })
}

/// Verifies the license key against Lemon Squeezy API.
pub async fn verify_online(key: &str) -> Result<LicenseStatus, String> {
    let machine_id = machine_uid::get().map_err(|e| format!("machine-id: {e}"))?;
    let body = serde_json::json!({ "license_key": key, "instance_name": machine_id });
    let resp = reqwest::Client::new()
        .post(LEMON_SQUEEZY_URL)
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;
    let json: serde_json::Value =
        resp.json().await.map_err(|e| format!("parse response: {e}"))?;
    let valid = json.get("valid").and_then(|v| v.as_bool()).unwrap_or(false);
    if !valid {
        return Err("license key is not valid".into());
    }
    Ok(LicenseStatus {
        valid: true,
        plan: extract_plan(&json),
        grace_remaining_days: None,
        last_verified: Utc::now().to_rfc3339(),
    })
}

/// Loads status and attempts online re-verification (grace fallback).
pub async fn check_and_reverify() -> Result<LicenseStatus, String> {
    let status = load_status()?;
    if !status.valid { return Ok(status); }
    let path = license_path()?;
    if !path.exists() { return Ok(status); }
    let encoded = fs::read_to_string(&path).map_err(|e| format!("read: {e}"))?;
    let plain = decrypt(&encoded)?;
    let stored: StoredLicense =
        serde_json::from_slice(&plain).map_err(|e| format!("deserialize: {e}"))?;
    match verify_online(&stored.key).await {
        Ok(fresh) => { save_key(&stored.key).await?; Ok(fresh) }
        Err(_) => Ok(status),
    }
}

/// Checks whether grace period is still valid.
pub fn is_grace_valid(last_verified: &str) -> Result<bool, String> {
    Ok(grace_remaining_days(last_verified)?.map_or(true, |d| d >= 0))
}

fn grace_remaining_days(last_verified: &str) -> Result<Option<i64>, String> {
    let ts: DateTime<Utc> = last_verified.parse()
        .map_err(|e| format!("parse timestamp: {e}"))?;
    let elapsed = Utc::now().signed_duration_since(ts).num_days();
    if elapsed <= GRACE_PERIOD_DAYS {
        Ok(Some(GRACE_PERIOD_DAYS - elapsed))
    } else {
        Ok(Some(-(elapsed - GRACE_PERIOD_DAYS)))
    }
}

fn extract_plan(json: &serde_json::Value) -> String {
    let variant = json.pointer("/meta/variant_name")
        .and_then(|v| v.as_str()).unwrap_or("Tester");
    match variant {
        v if v.to_lowercase().contains("founder") => "founders".into(),
        v if v.to_lowercase().contains("pro") => "pro".into(),
        _ => "tester".into(),
    }
}
