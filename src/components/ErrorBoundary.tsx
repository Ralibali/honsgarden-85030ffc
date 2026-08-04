import React from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
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
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted p-6">
          <div className="text-center max-w-md">
            <p className="text-5xl mb-4">🐔</p>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
              Något gick fel
            </h1>
            <p className="text-muted-foreground mb-6">
              Ett oväntat fel uppstod. Försök ladda om sidan.
            </p>
            <Button onClick={() => window.location.reload()}>
              Ladda om sidan
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
