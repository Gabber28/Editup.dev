use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;

use bytes::Bytes;
use http_body_util::{BodyExt, Full};
use hyper::body::Incoming;
use hyper::header::{HeaderName, HeaderValue, HOST};
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;

use crate::security::{assert_localhost_bind, validate_host_header, SessionToken, LOCALHOST};
use crate::ws::WS_PORT;

pub const PROXY_PORT: u16 = 9200;

pub struct ProxyState {
    pub session_token: SessionToken,
    pub target_origin: RwLock<Option<String>>,
    pub project_root: RwLock<Option<String>>,
}

impl ProxyState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            session_token: SessionToken::new(),
            target_origin: RwLock::new(None),
            project_root: RwLock::new(None),
        })
    }

    pub async fn set_target(&self, origin: String) -> Result<(), String> {
        validate_target_origin(&origin)?;
        *self.target_origin.write().await = Some(origin);
        Ok(())
    }

    pub async fn set_project_root(&self, path: String) -> Result<(), String> {
        let p = std::path::Path::new(&path);
        if !p.is_dir() {
            return Err(format!("not a directory: {path}"));
        }
        *self.project_root.write().await = Some(path);
        Ok(())
    }

    pub async fn require_project_root(&self) -> Result<String, String> {
        self.project_root
            .read()
            .await
            .clone()
            .ok_or_else(|| "project root not set".to_string())
    }
}

pub fn validate_target_origin(origin: &str) -> Result<(), String> {
    let parsed = url::Url::parse(origin).map_err(|e| format!("invalid url: {e}"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("scheme must be http or https".into());
    }
    let host = parsed.host_str().unwrap_or("");
    if !matches!(host, "127.0.0.1" | "localhost" | "[::1]" | "::1") {
        return Err(format!(
            "target host must be loopback (127.0.0.1/localhost), got: {host}"
        ));
    }
    Ok(())
}

pub async fn start_proxy(
    state: Arc<ProxyState>,
    _app: AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let addr = SocketAddr::new(LOCALHOST, PROXY_PORT);
    assert_localhost_bind(addr.ip())?;

    let listener = TcpListener::bind(addr).await?;
    tracing::info!("editup proxy listening on http://{addr}");

    loop {
        let (stream, peer) = listener.accept().await?;
        if peer.ip() != LOCALHOST {
            tracing::warn!("rejecting non-localhost peer: {peer}");
            drop(stream);
            continue;
        }
        let state = state.clone();
        let io = TokioIo::new(stream);
        tokio::spawn(async move {
            let service = service_fn(move |req| {
                let state = state.clone();
                async move { handle_request(req, state).await }
            });
            if let Err(err) = hyper::server::conn::http1::Builder::new()
                .serve_connection(io, service)
                .with_upgrades()
                .await
            {
                tracing::debug!("connection closed: {err}");
            }
        });
    }
}

async fn handle_request(
    req: Request<Incoming>,
    state: Arc<ProxyState>,
) -> Result<Response<Full<Bytes>>, Infallible> {
    let host_value = req
        .headers()
        .get(HOST)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    if validate_host_header(host_value.as_deref()).is_err() {
        return Ok(error_response(StatusCode::FORBIDDEN, "invalid host"));
    }

    if req.uri().path() == "/__editup__/health" {
        return Ok(text_response(StatusCode::OK, "ok"));
    }

    if req.uri().path() == "/__editup__/agent.js" {
        return Ok(serve_agent_script());
    }

    if req.uri().path() == "/__editup__/ws" {
        return Ok(text_response(
            StatusCode::BAD_REQUEST,
            "WebSocket moved to ws://127.0.0.1:9201",
        ));
    }

    let target = state.target_origin.read().await.clone();
    let Some(target) = target else {
        return Ok(text_response(
            StatusCode::SERVICE_UNAVAILABLE,
            "no target origin configured — call set_target_origin",
        ));
    };

    if is_websocket_upgrade(&req) {
        return handle_ws_tunnel(req, &target).await;
    }

    forward_request(req, &target, &state).await
}

async fn forward_request(
    req: Request<Incoming>,
    target: &str,
    state: &Arc<ProxyState>,
) -> Result<Response<Full<Bytes>>, Infallible> {
    let path_and_query = req
        .uri()
        .path_and_query()
        .map(|p| p.as_str().to_string())
        .unwrap_or_else(|| "/".into());
    let target_url = format!("{}{}", target.trim_end_matches('/'), path_and_query);

    let method = req.method().clone();
    let headers = req.headers().clone();
    let body_bytes = match req.collect().await {
        Ok(body) => body.to_bytes(),
        Err(err) => {
            tracing::warn!("failed to collect body: {err}");
            return Ok(error_response(
                StatusCode::BAD_GATEWAY,
                "failed to read request body",
            ));
        }
    };

    let client = upstream_client();
    let mut builder = client
        .request(method.clone(), &target_url)
        .body(body_bytes.to_vec());

    for (name, value) in headers.iter() {
        if matches!(
            name.as_str().to_lowercase().as_str(),
            "host" | "connection" | "content-length" | "accept-encoding"
        ) {
            continue;
        }
        builder = builder.header(name.as_str(), value.as_bytes());
    }

    let upstream = match builder.send().await {
        Ok(r) => r,
        Err(err) => {
            tracing::warn!("upstream error: {err}");
            return Ok(error_response(StatusCode::BAD_GATEWAY, "upstream error"));
        }
    };

    let status = upstream.status();
    let upstream_headers = upstream.headers().clone();
    let bytes = upstream.bytes().await.unwrap_or_default();

    let content_type = upstream_headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let injected = if content_type.starts_with("text/html") {
        inject_agent_script(&bytes, &state.session_token)
    } else {
        bytes.to_vec()
    };

    let mut resp_builder = Response::builder().status(status);
    for (name, value) in upstream_headers.iter() {
        if matches!(
            name.as_str().to_lowercase().as_str(),
            "content-length" | "transfer-encoding" | "content-encoding"
        ) {
            continue;
        }
        if name.as_str().eq_ignore_ascii_case("content-security-policy") {
            if let Ok(val_str) = value.to_str() {
                let patched = patch_csp(val_str);
                if let Ok(hv) = HeaderValue::from_str(&patched) {
                    resp_builder = resp_builder.header(name.clone(), hv);
                }
            }
            continue;
        }
        if let Ok(name) = HeaderName::from_bytes(name.as_str().as_bytes()) {
            if let Ok(val) = HeaderValue::from_bytes(value.as_bytes()) {
                resp_builder = resp_builder.header(name, val);
            }
        }
    }

    Ok(resp_builder
        .body(Full::new(Bytes::from(injected)))
        .unwrap_or_else(|_| {
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "build error")
        }))
}

fn inject_agent_script(html: &[u8], token: &SessionToken) -> Vec<u8> {
    let html_str = String::from_utf8_lossy(html);
    let snippet = format!(
        r#"<script>window.__EDITUP_CONFIG__={{wsUrl:"ws://127.0.0.1:{}?token={}",sessionToken:"{}"}};</script><script src="/__editup__/agent.js" defer></script>"#,
        WS_PORT,
        token.as_str(),
        token.as_str()
    );

    let lower = html_str.to_lowercase();
    let injected = if let Some(idx) = lower.find("</head>") {
        let mut out = String::with_capacity(html_str.len() + snippet.len());
        out.push_str(&html_str[..idx]);
        out.push_str(&snippet);
        out.push_str(&html_str[idx..]);
        out
    } else {
        format!("{snippet}{html_str}")
    };
    injected.into_bytes()
}

const AGENT_BUNDLE: &[u8] = include_bytes!("../../injected/dist/agent.js");

fn serve_agent_script() -> Response<Full<Bytes>> {
    Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "application/javascript; charset=utf-8")
        .body(Full::new(Bytes::from_static(AGENT_BUNDLE)))
        .unwrap()
}

fn error_response(status: StatusCode, msg: &str) -> Response<Full<Bytes>> {
    Response::builder()
        .status(status)
        .header("content-type", "text/plain")
        .body(Full::new(Bytes::from(msg.to_string())))
        .unwrap()
}

fn text_response(status: StatusCode, msg: &str) -> Response<Full<Bytes>> {
    Response::builder()
        .status(status)
        .header("content-type", "text/plain")
        .body(Full::new(Bytes::from(msg.to_string())))
        .unwrap()
}

fn is_websocket_upgrade(req: &Request<Incoming>) -> bool {
    let upgrade = req
        .headers()
        .get("upgrade")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    upgrade.eq_ignore_ascii_case("websocket")
}

async fn handle_ws_tunnel(
    req: Request<Incoming>,
    target: &str,
) -> Result<Response<Full<Bytes>>, Infallible> {
    let parsed = match url::Url::parse(target) {
        Ok(u) => u,
        Err(_) => return Ok(error_response(StatusCode::BAD_GATEWAY, "bad target url")),
    };
    let host = parsed.host_str().unwrap_or("127.0.0.1");
    let port = parsed.port().unwrap_or(80);
    let upstream_addr = format!("{host}:{port}");

    let path_and_query = req
        .uri()
        .path_and_query()
        .map(|p| p.as_str())
        .unwrap_or("/");

    let mut raw_req = format!(
        "GET {path_and_query} HTTP/1.1\r\nHost: {upstream_addr}\r\n"
    );
    for (name, value) in req.headers() {
        let n = name.as_str();
        if n.eq_ignore_ascii_case("host") {
            continue;
        }
        if let Ok(v) = value.to_str() {
            raw_req.push_str(&format!("{n}: {v}\r\n"));
        }
    }
    raw_req.push_str("\r\n");

    let mut upstream = match TcpStream::connect(&upstream_addr).await {
        Ok(s) => s,
        Err(e) => {
            tracing::warn!("ws tunnel connect failed: {e}");
            return Ok(error_response(StatusCode::BAD_GATEWAY, "upstream connect failed"));
        }
    };

    if upstream.write_all(raw_req.as_bytes()).await.is_err() {
        return Ok(error_response(StatusCode::BAD_GATEWAY, "upstream write failed"));
    }

    let mut resp_buf = vec![0u8; 4096];
    let n = match upstream.read(&mut resp_buf).await {
        Ok(n) if n > 0 => n,
        _ => return Ok(error_response(StatusCode::BAD_GATEWAY, "upstream read failed")),
    };

    let header_end = resp_buf[..n]
        .windows(4)
        .position(|w| w == b"\r\n\r\n");

    let Some(header_end_pos) = header_end else {
        tracing::warn!("ws tunnel: malformed upstream response (no header terminator)");
        return Ok(error_response(StatusCode::BAD_GATEWAY, "malformed upstream response"));
    };

    let header_str = String::from_utf8_lossy(&resp_buf[..header_end_pos]);
    if !header_str.contains("101") {
        tracing::warn!("ws tunnel: upstream did not return 101");
        return Ok(error_response(StatusCode::BAD_GATEWAY, "upstream rejected upgrade"));
    }

    let leftover = resp_buf[header_end_pos + 4..n].to_vec();

    let mut resp_builder = Response::builder().status(StatusCode::SWITCHING_PROTOCOLS);
    for line in header_str.lines().skip(1) {
        if let Some((name, value)) = line.split_once(':') {
            let name = name.trim();
            let value = value.trim();
            if let (Ok(hn), Ok(hv)) = (
                HeaderName::from_bytes(name.as_bytes()),
                HeaderValue::from_str(value),
            ) {
                resp_builder = resp_builder.header(hn, hv);
            }
        }
    }

    tokio::spawn(async move {
        match hyper::upgrade::on(req).await {
            Ok(upgraded) => {
                let mut client_io = TokioIo::new(upgraded);
                if !leftover.is_empty() {
                    if client_io.write_all(&leftover).await.is_err() {
                        return;
                    }
                }
                let (mut ur, mut uw) = upstream.split();
                let (mut cr, mut cw) = tokio::io::split(&mut client_io);
                let _ = tokio::join!(
                    tokio::io::copy(&mut ur, &mut cw),
                    tokio::io::copy(&mut cr, &mut uw),
                );
            }
            Err(e) => tracing::debug!("ws tunnel upgrade failed: {e}"),
        }
    });

    Ok(resp_builder
        .body(Full::new(Bytes::new()))
        .unwrap())
}

fn patch_csp(csp: &str) -> String {
    let editup_sources = format!(
        "ws://127.0.0.1:{} http://127.0.0.1:{}",
        WS_PORT, PROXY_PORT
    );
    let mut result = String::with_capacity(csp.len() + editup_sources.len() * 2 + 40);
    let mut patched_connect = false;
    let mut patched_script = false;
    for directive in csp.split(';') {
        let trimmed = directive.trim();
        if !result.is_empty() {
            result.push_str("; ");
        }
        if trimmed.starts_with("connect-src") {
            result.push_str(trimmed);
            result.push(' ');
            result.push_str(&editup_sources);
            patched_connect = true;
        } else if trimmed.starts_with("script-src") {
            result.push_str(trimmed);
            result.push_str(" 'unsafe-inline'");
            patched_script = true;
        } else {
            result.push_str(trimmed);
        }
    }
    if !patched_connect {
        result.push_str("; connect-src 'self' ");
        result.push_str(&editup_sources);
    }
    if !patched_script {
        result.push_str("; script-src 'self' 'unsafe-inline'");
    }
    result
}

fn upstream_client() -> reqwest::Client {
    static CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .no_proxy()
                .build()
                .expect("reqwest client init")
        })
        .clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_origin_accepts_localhost() {
        assert!(validate_target_origin("http://localhost:3000").is_ok());
        assert!(validate_target_origin("http://127.0.0.1:5173").is_ok());
    }

    #[test]
    fn target_origin_rejects_external() {
        assert!(validate_target_origin("http://example.com").is_err());
        assert!(validate_target_origin("https://attacker.com").is_err());
    }

    #[test]
    fn target_origin_rejects_non_http_scheme() {
        assert!(validate_target_origin("ftp://localhost").is_err());
        assert!(validate_target_origin("file:///etc/passwd").is_err());
    }
}
