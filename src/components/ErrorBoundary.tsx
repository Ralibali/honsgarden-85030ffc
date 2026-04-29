import React from 'react';
import { Button } from '@/components/ui/button';
import { logClientError, clearStoredErrorLog } from '@/lib/errorLogger';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId?: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    this.setState({ errorId });

    void logClientError(error, {
      level: 'error',
      context: {
        source: 'ErrorBoundary',
        errorId,
        componentStack: errorInfo.componentStack,
      },
    });
  }

  handleReload = () => {
    // Rensa inte felloggen – supporten kan behöva den om användaren
    // rapporterar problemet efter omladdning.
    window.location.reload();
  };

  handleReset = () => {
    clearStoredErrorLog();
    this.setState({ hasError: false, error: undefined, errorId: undefined });
  };

  render() {
    if (this.state.hasError) {
      const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted p-6">
          <div className="text-center max-w-md w-full">
            <p className="text-5xl mb-4">🐔</p>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
              Något gick fel
            </h1>
            <p className="text-muted-foreground mb-6">
              Ett oväntat fel uppstod. Försök ladda om sidan – om det händer igen,
              kontakta support och nämn fel-id:t nedan.
            </p>
            {this.state.errorId ? (
              <p className="text-xs text-muted-foreground mb-6 font-mono break-all">
                Fel-ID: {this.state.errorId}
              </p>
            ) : null}
            {isDev && this.state.error ? (
              <pre className="text-left text-[11px] bg-card border border-border rounded-lg p-3 mb-4 overflow-auto max-h-48 whitespace-pre-wrap">
                {this.state.error.name}: {this.state.error.message}
                {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
              </pre>
            ) : null}
            <div className="flex gap-2 justify-center flex-wrap">
              <Button onClick={this.handleReload}>Ladda om sidan</Button>
              <Button variant="outline" onClick={this.handleReset}>
                Försök igen
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
