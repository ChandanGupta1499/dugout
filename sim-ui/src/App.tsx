import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import {
  fetchCommentary,
  fetchMatches,
  fetchStatus,
  getStoredAdminKey,
  pauseSim,
  postChat,
  postCommentary,
  resumeSim,
  setSpeed,
  setStoredAdminKey,
  startSim,
  stopSim,
  type CommentaryRow,
  type MatchSummary,
  type SimStatus,
} from './api';

const DEFAULT_MATCH = 'eng-arg-semi-2026';
/** First chat line in normalized data (~YouTube offset where crowd chat starts). */
const DEFAULT_KICKOFF_MS = 3_633_881;

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function App() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [matchId, setMatchId] = useState(DEFAULT_MATCH);
  const [kickoffOffsetMs, setKickoffOffsetMs] = useState(DEFAULT_KICKOFF_MS);
  const [speed, setSpeedLocal] = useState(10);
  const [status, setStatus] = useState<SimStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [adminKey, setAdminKey] = useState(getStoredAdminKey);
  const [chatAuthor, setChatAuthor] = useState('admin');
  const [chatText, setChatText] = useState('');
  const [commentaryMinute, setCommentaryMinute] = useState('');
  const [commentaryType, setCommentaryType] = useState('');
  const [commentaryScoreAfter, setCommentaryScoreAfter] = useState('');
  const [commentaryText, setCommentaryText] = useState('');
  const [commentaryRows, setCommentaryRows] = useState<CommentaryRow[]>([]);
  const [injectBusy, setInjectBusy] = useState(false);
  const [injectMessage, setInjectMessage] = useState<string | null>(null);

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === matchId) ?? null,
    [matches, matchId],
  );
  const hasChannel = Boolean(selectedMatch?.channelId);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchStatus();
      setStatus(next);
      if (
        next.state === 'running' ||
        next.state === 'paused' ||
        next.state === 'finished'
      ) {
        if (next.matchId) setMatchId(next.matchId);
        setSpeedLocal(next.speed);
        setKickoffOffsetMs(next.kickoffOffsetMs);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load status');
    }
  }, []);

  const refreshMatches = useCallback(async () => {
    try {
      const list = await fetchMatches();
      setMatches(list);
      setMatchId((current) => {
        if (list.some((m) => m.id === current)) return current;
        return list[0]?.id ?? current;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
    }
  }, []);

  const refreshCommentary = useCallback(async () => {
    if (!adminKey.trim() || !matchId) {
      setCommentaryRows([]);
      return;
    }
    try {
      const rows = await fetchCommentary(matchId, adminKey.trim());
      setCommentaryRows(rows);
    } catch {
      setCommentaryRows([]);
    }
  }, [adminKey, matchId]);

  useEffect(() => {
    void refreshMatches();
  }, [refreshMatches]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 500);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    void refreshCommentary();
  }, [refreshCommentary]);

  const run = async (fn: () => Promise<SimStatus>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const onAdminKeyChange = (value: string) => {
    setAdminKey(value);
    setStoredAdminKey(value);
  };

  const requireAdminKey = () => {
    const key = adminKey.trim();
    if (!key) {
      throw new Error('Admin key is required');
    }
    return key;
  };

  const sendChat = async () => {
    setInjectBusy(true);
    setInjectMessage(null);
    setError(null);
    try {
      const key = requireAdminKey();
      if (!chatText.trim()) {
        throw new Error('Chat text is required');
      }
      if (!hasChannel) {
        throw new Error('Selected match has no Stream channel id');
      }
      await postChat(
        {
          matchId,
          text: chatText.trim(),
          author: chatAuthor.trim() || undefined,
        },
        key,
      );
      setChatText('');
      setInjectMessage('Chat sent to Stream');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send chat');
    } finally {
      setInjectBusy(false);
    }
  };

  const sendCommentary = async () => {
    setInjectBusy(true);
    setInjectMessage(null);
    setError(null);
    try {
      const key = requireAdminKey();
      if (!commentaryText.trim()) {
        throw new Error('Commentary text is required');
      }
      await postCommentary(
        {
          matchId,
          text: commentaryText.trim(),
          minute: commentaryMinute.trim() || undefined,
          type: commentaryType.trim() || undefined,
          scoreAfter: commentaryScoreAfter.trim() || undefined,
        },
        key,
      );
      setCommentaryText('');
      setInjectMessage('Commentary saved to Supabase');
      await refreshCommentary();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save commentary',
      );
    } finally {
      setInjectBusy(false);
    }
  };

  const active =
    status?.state === 'running' ||
    status?.state === 'paused' ||
    status?.state === 'finished';

  const matchSelectDisabled = active && status?.state !== 'finished';

  return (
    <div className="page">
      <header>
        <h1>Dugout match sim</h1>
        <p className="sub">
          Inject shared chat/commentary for testers, or replay YouTube chat into
          Stream. Banter stays in the Expo app.
        </p>
      </header>

      <section className="card">
        <h2>Match</h2>
        <label>
          Admin API key
          <input
            type="password"
            autoComplete="off"
            value={adminKey}
            onChange={(e) => onAdminKeyChange(e.target.value)}
            placeholder="X-Admin-Key for /admin/*"
          />
        </label>
        <label>
          Match
          <select
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            disabled={matchSelectDisabled}
          >
            {matches.length === 0 && (
              <option value={matchId}>{matchId}</option>
            )}
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
                {!m.channelId ? ' (no chat)' : ''}
              </option>
            ))}
          </select>
        </label>
        {selectedMatch && !hasChannel && (
          <p className="hint">
            This match has no Stream channel id — chat inject is disabled until
            one is set in Supabase.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Inject chat</h2>
        <label>
          Author
          <input
            value={chatAuthor}
            onChange={(e) => setChatAuthor(e.target.value)}
            placeholder="admin"
          />
        </label>
        <label>
          Message
          <textarea
            rows={3}
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="Crowd chat line…"
          />
        </label>
        <div className="actions">
          <button
            disabled={injectBusy || !hasChannel || !chatText.trim()}
            onClick={() => void sendChat()}
          >
            Send chat
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Inject commentary</h2>
        <p className="hint">
          Stored in Supabase for all testers. Feeds banter/scoreboard only (not
          Stream). For goals use type <code>goal</code> and score_after like{' '}
          <code>1-0</code> (team A – team B).
        </p>
        <div className="row">
          <label>
            Minute
            <input
              value={commentaryMinute}
              onChange={(e) => setCommentaryMinute(e.target.value)}
              placeholder="55'"
            />
          </label>
          <label>
            Type
            <input
              value={commentaryType}
              onChange={(e) => setCommentaryType(e.target.value)}
              placeholder="goal / chance / …"
            />
          </label>
          <label>
            Score after
            <input
              value={commentaryScoreAfter}
              onChange={(e) => setCommentaryScoreAfter(e.target.value)}
              placeholder="1-0"
            />
          </label>
        </div>
        <label>
          Text
          <textarea
            rows={3}
            value={commentaryText}
            onChange={(e) => setCommentaryText(e.target.value)}
            placeholder="GOAL! …"
          />
        </label>
        <div className="actions">
          <button
            disabled={injectBusy || !commentaryText.trim()}
            onClick={() => void sendCommentary()}
          >
            Save commentary
          </button>
          <button
            type="button"
            className="secondary"
            disabled={injectBusy || !adminKey.trim()}
            onClick={() => void refreshCommentary()}
          >
            Refresh list
          </button>
        </div>
        <ul className="peek commentary-list">
          {[...commentaryRows].reverse().map((row) => (
            <li key={row.id}>
              <span className="off">{row.minuteLabel ?? '—'}</span>
              <strong>{row.type ?? 'event'}</strong>
              <span>
                {row.text}
                {row.scoreAfter ? ` (${row.scoreAfter})` : ''}
              </span>
            </li>
          ))}
          {!commentaryRows.length && (
            <li>No Supabase commentary for this match yet</li>
          )}
        </ul>
      </section>

      <section className="card">
        <h2>YouTube replay</h2>
        <label>
          Kickoff offset (ms)
          <input
            type="number"
            min={0}
            value={kickoffOffsetMs}
            onChange={(e) => setKickoffOffsetMs(Number(e.target.value) || 0)}
            disabled={status?.state === 'running' || status?.state === 'paused'}
          />
        </label>
        <label>
          Speed
          <select
            value={speed}
            onChange={(e) => {
              const next = Number(e.target.value);
              setSpeedLocal(next);
              if (status?.state === 'running' || status?.state === 'paused') {
                void run(() => setSpeed(next));
              }
            }}
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </label>

        <div className="actions">
          <button
            disabled={
              busy || status?.state === 'running' || status?.state === 'paused'
            }
            onClick={() =>
              void run(() => startSim({ matchId, speed, kickoffOffsetMs }))
            }
          >
            Start
          </button>
          <button
            disabled={busy || status?.state !== 'running'}
            onClick={() => void run(pauseSim)}
          >
            Pause
          </button>
          <button
            disabled={busy || status?.state !== 'paused'}
            onClick={() => void run(resumeSim)}
          >
            Resume
          </button>
          <button
            disabled={busy || status?.state === 'idle'}
            onClick={() => void run(stopSim)}
          >
            Stop
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Status</h2>
        {status ? (
          <dl className="status">
            <div>
              <dt>State</dt>
              <dd>{status.state}</dd>
            </div>
            <div>
              <dt>Match</dt>
              <dd>{status.matchId ?? '—'}</dd>
            </div>
            <div>
              <dt>Elapsed</dt>
              <dd>{formatElapsed(status.elapsedSimMs)}</dd>
            </div>
            <div>
              <dt>Match minute</dt>
              <dd>{status.matchMinute.toFixed(1)}'</dd>
            </div>
            <div>
              <dt>Sent</dt>
              <dd>
                {status.sentCount} / cursor {status.cursor} /{' '}
                {status.totalMessages}
              </dd>
            </div>
            <div>
              <dt>Speed</dt>
              <dd>{status.speed}x</dd>
            </div>
            <div>
              <dt>Kickoff offset</dt>
              <dd>{status.kickoffOffsetMs} ms</dd>
            </div>
          </dl>
        ) : (
          <p>Loading…</p>
        )}
        {(error || status?.lastError) && (
          <p className="error">{error || status?.lastError}</p>
        )}
        {injectMessage && <p className="ok">{injectMessage}</p>}
      </section>

      <section className="card">
        <h2>Next messages</h2>
        <ul className="peek">
          {(status?.peek ?? []).map((msg, i) => (
            <li key={`${msg.offsetMs}-${i}`}>
              <span className="off">{Math.round(msg.offsetMs / 1000)}s</span>
              <strong>{msg.author}</strong>
              <span>{msg.text}</span>
            </li>
          ))}
          {!status?.peek?.length && <li>Queue empty</li>}
        </ul>
      </section>
    </div>
  );
}
