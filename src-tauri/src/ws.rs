use std::net::SocketAddr;
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::net::TcpListener;
use tokio::sync::{broadcast, mpsc, RwLock};
use tokio_tungstenite::tungstenite::Message;

use crate::security::{validate_host_header, validate_origin, SessionToken, LOCALHOST};

pub const WS_PORT: u16 = 9201;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub payload: Option<serde_json::Value>,
    pub token: Option<String>,
}

pub struct WsState {
    pub to_agent_tx: broadcast::Sender<String>,
    pub from_agent_tx: mpsc::Sender<AgentMessage>,
    pub connected: Arc<RwLock<bool>>,
    pub editing: Arc<RwLock<bool>>,
    pub latest_snapshot: Arc<RwLock<Option<serde_json::Value>>>,
    session_token: SessionToken,
}

impl WsState {
    pub fn new(from_agent_tx: mpsc::Sender<AgentMessage>, session_token: SessionToken) -> Self {
        let (to_agent_tx, _) = broadcast::channel(64);
        Self {
            to_agent_tx,
            from_agent_tx,
            connected: Arc::new(RwLock::new(false)),
            editing: Arc::new(RwLock::new(false)),
            latest_snapshot: Arc::new(RwLock::new(None)),
            session_token,
        }
    }
}

pub async fn start_ws_server(
    state: Arc<WsState>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let addr = SocketAddr::new(LOCALHOST, WS_PORT);
    let listener = TcpListener::bind(addr).await?;
    tracing::info!("editup ws listening on ws://{addr}");

    loop {
        let (stream, peer) = listener.accept().await?;
        if peer.ip() != LOCALHOST {
            tracing::warn!("rejecting non-localhost ws peer: {peer}");
            drop(stream);
            continue;
        }
        let state = state.clone();
        tokio::spawn(async move {
            let callback = |req: &tokio_tungstenite::tungstenite::handshake::server::Request,
                            resp: tokio_tungstenite::tungstenite::handshake::server::Response| {
                let header = |name: &str| {
                    req.headers()
                        .get(name)
                        .and_then(|v| v.to_str().ok())
                };
                if validate_host_header(header("host")).is_err()
                    || validate_origin(header("origin")).is_err()
                {
                    tracing::warn!("ws: rejected handshake (invalid host/origin)");
                    let err = tokio_tungstenite::tungstenite::http::Response::builder()
                        .status(tokio_tungstenite::tungstenite::http::StatusCode::FORBIDDEN)
                        .body(Some("invalid host or origin".to_string()))
                        .expect("build forbidden response");
                    return Err(err);
                }
                Ok(resp)
            };
            let ws = match tokio_tungstenite::accept_hdr_async(stream, callback).await {
                Ok(ws) => ws,
                Err(err) => {
                    tracing::warn!("ws handshake failed: {err}");
                    return;
                }
            };
            handle_connection(ws, state).await;
        });
    }
}

async fn handle_connection<S>(
    ws: tokio_tungstenite::WebSocketStream<S>,
    state: Arc<WsState>,
) where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    let (mut sink, mut stream) = ws.split();

    let hello = match tokio::time::timeout(std::time::Duration::from_secs(5), stream.next()).await
    {
        Ok(Some(Ok(Message::Text(text)))) => serde_json::from_str::<AgentMessage>(&text).ok(),
        _ => None,
    };

    let valid = hello
        .as_ref()
        .filter(|m| m.msg_type == "hello")
        .and_then(|m| m.token.as_deref())
        .map(|t| state.session_token.verify(t).is_ok())
        .unwrap_or(false);

    if !valid {
        tracing::warn!("ws: invalid or missing hello/token");
        let _ = sink.close().await;
        return;
    }

    *state.connected.write().await = true;
    tracing::info!("agent connected via WebSocket");

    let mut to_agent_rx = state.to_agent_tx.subscribe();
    let from_agent_tx = state.from_agent_tx.clone();

    let editing = *state.editing.read().await;
    let msg = serde_json::json!({"type": "set_editing", "payload": {"editing": editing}});
    if sink.send(Message::Text(msg.to_string())).await.is_err() {
        tracing::warn!("failed to send initial editing state to agent");
        return;
    }
    tracing::info!("sent editing={editing} to newly connected agent");

    loop {
        tokio::select! {
            msg = stream.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        if let Ok(parsed) = serde_json::from_str::<AgentMessage>(&text) {
                            let _ = from_agent_tx.send(parsed).await;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(err)) => {
                        tracing::debug!("ws recv error: {err}");
                        break;
                    }
                    _ => {}
                }
            }
            msg = to_agent_rx.recv() => {
                match msg {
                    Ok(text) => {
                        if sink.send(Message::Text(text)).await.is_err() {
                            break;
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                        tracing::warn!("agent ws receiver lagged, skipped {n} messages");
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                }
            }
        }
    }

    *state.connected.write().await = false;
    tracing::info!("agent disconnected");
}

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
