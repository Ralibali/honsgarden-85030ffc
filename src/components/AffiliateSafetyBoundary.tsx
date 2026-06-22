import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Affiliatefunktioner får aldrig slå ut en bloggartikel.
 * Vid ett oväntat fel döljs endast reklamkomponenten.
 */
export class AffiliateSafetyBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Affiliate component failed safely:', error, info);
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export default AffiliateSafetyBoundary;
