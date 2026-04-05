import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

// Error boundary — prevents blank screen when a React component throws.
// Shows a minimal dark overlay with the error message instead.
class RootErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#0d0d0d',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 16, padding: 32,
          fontFamily: 'monospace', color: '#ff6b6b',
        }}>
          <div style={{ fontSize: 13, letterSpacing: 4, color: '#fff', opacity: 0.5 }}>
            ATOM INK — STARTUP ERROR
          </div>
          <div style={{ fontSize: 12, maxWidth: 540, textAlign: 'center', lineHeight: 1.7 }}>
            {this.state.error}
          </div>
          <button
            style={{
              marginTop: 8, padding: '8px 24px', borderRadius: 20,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', cursor: 'pointer', fontSize: 11, letterSpacing: 2,
            }}
            onClick={() => window.location.reload()}
          >
            RELOAD
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
