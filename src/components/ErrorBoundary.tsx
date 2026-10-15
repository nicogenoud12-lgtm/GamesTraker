import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Shows the crash instead of a blank screen, so it can be reported. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="pt-safe mx-auto max-w-lg px-5 py-10">
        <p className="text-4xl">😵</p>
        <h1 className="mt-3 font-display text-2xl font-bold">Algo se rompió</h1>
        <p className="mt-2 text-sm text-muted">Mandale una captura de este mensaje a quien te armó la app.</p>
        <pre className="mt-4 max-h-72 overflow-auto rounded-2xl border border-line bg-surface p-4 text-xs whitespace-pre-wrap text-rose-300">
          {`${error.name}: ${error.message}\n${error.stack ?? ''}`}
        </pre>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => {
              window.location.hash = '#/';
              window.location.reload();
            }}
            className="rounded-full bg-white px-5 py-3 font-semibold text-black"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }
}
