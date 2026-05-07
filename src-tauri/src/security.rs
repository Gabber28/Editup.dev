use std::net::{IpAddr, Ipv4Addr};
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum SecurityError {
    #[error("server bind must be 127.0.0.1, got {0}")]
    InvalidBindAddress(String),
    #[error("invalid host header: {0}")]
    InvalidHost(String),
    #[error("invalid origin: {0}")]
    InvalidOrigin(String),
    #[error("missing or invalid session token")]
    InvalidToken,
}

pub const LOCALHOST: IpAddr = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

pub fn assert_localhost_bind(addr: IpAddr) -> Result<(), SecurityError> {
    if addr == LOCALHOST {
        Ok(())
    } else {
        Err(SecurityError::InvalidBindAddress(addr.to_string()))
    }
}

pub fn validate_host_header(host: Option<&str>) -> Result<(), SecurityError> {
    let Some(host) = host else {
        return Err(SecurityError::InvalidHost("<missing>".into()));
    };
    let mut parts = host.splitn(2, ':');
    let host_only = parts.next().unwrap_or("");
    let port = parts.next();
    if !matches!(host_only, "127.0.0.1" | "localhost") {
        return Err(SecurityError::InvalidHost(host.to_string()));
    }
    if let Some(p) = port {
        if p.parse::<u16>().is_err() {
            return Err(SecurityError::InvalidHost(host.to_string()));
        }
    }
    Ok(())
}

pub fn validate_origin(origin: Option<&str>) -> Result<(), SecurityError> {
    let Some(origin) = origin else { return Ok(()) };
    let lower = origin.to_lowercase();
    if lower.starts_with("http://127.0.0.1")
        || lower.starts_with("http://localhost")
        || lower.starts_with("https://127.0.0.1")
        || lower.starts_with("https://localhost")
        || lower.starts_with("tauri://")
    {
        Ok(())
    } else {
        Err(SecurityError::InvalidOrigin(origin.to_string()))
    }
}

#[derive(Clone)]
pub struct SessionToken(String);

impl SessionToken {
    pub fn new() -> Self {
        Self(Uuid::new_v4().to_string())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn verify(&self, candidate: &str) -> Result<(), SecurityError> {
        if constant_time_eq(self.0.as_bytes(), candidate.as_bytes()) {
            Ok(())
        } else {
            Err(SecurityError::InvalidToken)
        }
    }
}

impl Default for SessionToken {
    fn default() -> Self {
        Self::new()
    }
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for i in 0..a.len() {
        diff |= a[i] ^ b[i];
    }
    diff == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_localhost_bind() {
        let result = assert_localhost_bind("0.0.0.0".parse().unwrap());
        assert!(result.is_err());
    }

    #[test]
    fn accepts_localhost_bind() {
        assert!(assert_localhost_bind(LOCALHOST).is_ok());
    }

    #[test]
    fn rejects_external_host() {
        assert!(validate_host_header(Some("example.com")).is_err());
    }

    #[test]
    fn accepts_localhost_host() {
        assert!(validate_host_header(Some("127.0.0.1:9200")).is_ok());
        assert!(validate_host_header(Some("localhost:9200")).is_ok());
    }

    #[test]
    fn token_constant_time_eq() {
        let token = SessionToken::new();
        assert!(token.verify(token.as_str()).is_ok());
        assert!(token.verify("invalid").is_err());
    }
}
