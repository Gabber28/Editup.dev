use chrono::{DateTime, Datelike, Timelike, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::license;

const TESTER_DAILY_LIMIT: u32 = 15;
const PRO_HOURLY_LIMIT: u32 = 30;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RateLimitState {
    pub plan: String,
    pub edits_used: u32,
    pub edits_limit: u32,
    pub resets_at: String,
    pub blocked: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct StoredRateLimit {
    edits_used: u32,
    period_start: String,
    plan: String,
}

/// Returns path to `~/.editup/rate-limit.json`.
fn rate_limit_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("cannot determine home directory")?;
    Ok(home.join(".editup").join("rate-limit.json"))
}

/// Loads stored rate limit data or returns a fresh default.
fn load_stored(plan: &str) -> Result<StoredRateLimit, String> {
    let path = rate_limit_path()?;
    if !path.exists() {
        return Ok(StoredRateLimit {
            edits_used: 0,
            period_start: Utc::now().to_rfc3339(),
            plan: plan.to_string(),
        });
    }
    let contents =
        fs::read_to_string(&path).map_err(|e| format!("read rate-limit: {e}"))?;
    let stored: StoredRateLimit = serde_json::from_str(&contents)
        .map_err(|e| format!("parse rate-limit: {e}"))?;
    Ok(stored)
}

/// Persists rate limit data to disk.
fn save_stored(stored: &StoredRateLimit) -> Result<(), String> {
    let path = rate_limit_path()?;
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("mkdir rate-limit: {e}"))?;
        }
    }
    let json =
        serde_json::to_string_pretty(stored).map_err(|e| format!("serialize: {e}"))?;
    fs::write(path, json).map_err(|e| format!("write rate-limit: {e}"))?;
    Ok(())
}

/// Checks if the stored period has expired and resets if needed.
fn maybe_reset(stored: &mut StoredRateLimit) -> Result<(), String> {
    let period_start: DateTime<Utc> = stored
        .period_start
        .parse()
        .map_err(|e| format!("parse period_start: {e}"))?;
    let now = Utc::now();
    let should_reset = if stored.plan == "tester" {
        now.date_naive() != period_start.date_naive()
    } else {
        now.ordinal() != period_start.ordinal()
            || now.hour() != period_start.hour()
    };
    if should_reset {
        stored.edits_used = 0;
        stored.period_start = now.to_rfc3339();
    }
    Ok(())
}

/// Computes when the current period resets (ISO 8601).
fn compute_resets_at(plan: &str, period_start: &str) -> Result<String, String> {
    let start: DateTime<Utc> = period_start
        .parse()
        .map_err(|e| format!("parse period: {e}"))?;
    let resets_at = if plan == "tester" {
        let tomorrow = start.date_naive().succ_opt().ok_or("date overflow")?;
        tomorrow
            .and_hms_opt(0, 0, 0)
            .ok_or("time creation failed")?
            .and_utc()
    } else {
        let next_hour = start
            .date_naive()
            .and_hms_opt(start.hour() + 1, 0, 0);
        match next_hour {
            Some(dt) => dt.and_utc(),
            None => {
                let tomorrow =
                    start.date_naive().succ_opt().ok_or("date overflow")?;
                tomorrow
                    .and_hms_opt(0, 0, 0)
                    .ok_or("time creation failed")?
                    .and_utc()
            }
        }
    };
    Ok(resets_at.to_rfc3339())
}

/// Returns the edit limit for the given plan.
fn limit_for_plan(plan: &str) -> u32 {
    if plan == "tester" {
        TESTER_DAILY_LIMIT
    } else {
        PRO_HOURLY_LIMIT
    }
}

/// Increments the edit counter, blocking if limit is reached.
pub fn increment() -> Result<RateLimitState, String> {
    let status = license::load_status()?;
    let plan = &status.plan;
    let mut stored = load_stored(plan)?;
    stored.plan = plan.clone();
    maybe_reset(&mut stored)?;
    let limit = limit_for_plan(plan);
    if stored.edits_used >= limit {
        save_stored(&stored)?;
        return Ok(build_state(&stored, limit, true)?);
    }
    stored.edits_used += 1;
    save_stored(&stored)?;
    let blocked = stored.edits_used >= limit;
    build_state(&stored, limit, blocked)
}

/// Returns the current rate limit state without incrementing.
pub fn get_state() -> Result<RateLimitState, String> {
    let status = license::load_status()?;
    let plan = &status.plan;
    let mut stored = load_stored(plan)?;
    stored.plan = plan.clone();
    maybe_reset(&mut stored)?;
    save_stored(&stored)?;
    let limit = limit_for_plan(plan);
    let blocked = stored.edits_used >= limit;
    build_state(&stored, limit, blocked)
}

/// Returns whether the current user should be blocked from editing.
pub fn should_block() -> Result<bool, String> {
    let state = get_state()?;
    Ok(state.blocked)
}

fn build_state(
    stored: &StoredRateLimit,
    limit: u32,
    blocked: bool,
) -> Result<RateLimitState, String> {
    let resets_at = compute_resets_at(&stored.plan, &stored.period_start)?;
    Ok(RateLimitState {
        plan: stored.plan.clone(),
        edits_used: stored.edits_used,
        edits_limit: limit,
        resets_at,
        blocked,
    })
}
