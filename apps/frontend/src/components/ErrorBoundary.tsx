import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches runtime render errors so one broken page doesn't blank the whole app.
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
    window.location.assign('/dashboard');
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-outline-variant bg-surface-container p-8 text-center shadow-xl">
          <span className="material-symbols-outlined text-error text-5xl">error</span>
          <h1 className="mt-4 text-xl font-bold text-on-surface">Terjadi kesalahan</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Halaman ini mengalami error tak terduga. Silakan muat ulang atau kembali ke dashboard.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-black/30 p-3 text-left text-xs text-error">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-6 flex justify-center gap-3">
            <button
              id="error-boundary-reload"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-outline-variant px-4 py-2 text-sm text-on-surface hover:bg-white/5 transition-colors"
            >
              Muat Ulang
            </button>
            <button
              id="error-boundary-home"
              onClick={this.handleReset}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90 transition-opacity"
            >
              Ke Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
