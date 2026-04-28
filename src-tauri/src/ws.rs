use crate::security::{validate_host_header, validate_origin, SessionToken};

pub fn validate_ws_handshake(
    host: Option<&str>,
    origin: Option<&str>,
    provided_token: Option<&str>,
    expected_token: &SessionToken,
) -> Result<(), &'static str> {
    if validate_host_header(host).is_err() {
        return Err("invalid host");
    }
    if validate_origin(origin).is_err() {
        return Err("invalid origin");
    }
    let Some(provided) = provided_token else {
        return Err("missing token");
    };
    if expected_token.verify(provided).is_err() {
        return Err("invalid token");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_external_host() {
        let token = SessionToken::new();
        let result = validate_ws_handshake(
            Some("example.com"),
            Some("http://127.0.0.1:9200"),
            Some(token.as_str()),
            &token,
        );
        assert!(result.is_err());
    }

    #[test]
    fn rejects_external_origin() {
        let token = SessionToken::new();
        let result = validate_ws_handshake(
            Some("127.0.0.1:9200"),
            Some("https://attacker.com"),
            Some(token.as_str()),
            &token,
        );
        assert!(result.is_err());
    }

    #[test]
    fn rejects_missing_token() {
        let token = SessionToken::new();
        let result = validate_ws_handshake(
            Some("127.0.0.1:9200"),
            Some("http://127.0.0.1:9200"),
            None,
            &token,
        );
        assert!(result.is_err());
    }

    #[test]
    fn rejects_wrong_token() {
        let token = SessionToken::new();
        let result = validate_ws_handshake(
            Some("127.0.0.1:9200"),
            Some("http://127.0.0.1:9200"),
            Some("wrong-token"),
            &token,
        );
        assert!(result.is_err());
    }

    #[test]
    fn accepts_valid_handshake() {
        let token = SessionToken::new();
        let result = validate_ws_handshake(
            Some("127.0.0.1:9200"),
            Some("http://127.0.0.1:9200"),
            Some(token.as_str()),
            &token,
        );
        assert!(result.is_ok());
    }
}
