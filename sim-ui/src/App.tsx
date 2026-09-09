import { useCallback, useEffect, useState } from 'react';
import './App.css';
import {
  fetchStatus,
  pauseSim,
  resumeSim,
  setSpeed,
  startSim,
  stopSim,
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
  const [matchId, setMatchId] = useState(DEFAULT_MATCH);
  const [kickoffOffsetMs, setKickoffOffsetMs] = useState(DEFAULT_KICKOFF_MS);
  const [speed, setSpeedLocal] = useState(10);
  const [status, setStatus] = useState<SimStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      void refresh();
    }, 500);
    return () => clearInterval(id);
  }, [refresh]);

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

  const active =
    status?.state === 'running' ||
    status?.state === 'paused' ||
    status?.state === 'finished';

  return (
    <div className="page">
      <header>
        <h1>Dugout match sim</h1>
        <p className="sub">
          Replay YouTube chat into Stream. Banter stays in the Expo app.
        </p>
      </header>

      <section className="card">
        <label>
          Match id
          <input
            value={matchId}
            onChange={(e) => setMatchId(e.target.value)}
            disabled={active && status?.state !== 'finished'}
          />
        </label>
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
            disabled={busy || status?.state === 'running' || status?.state === 'paused'}
            onClick={() =>
              void run(() =>
                startSim({ matchId, speed, kickoffOffsetMs }),
              )
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
