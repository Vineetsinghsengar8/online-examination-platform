import React from 'react';

type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // You could send the error to an external logging service here
    console.error('Uncaught error in tree:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h1 style={{ color: '#b91c1c' }}>Application error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fee', padding: 12, borderRadius: 6, color: '#333' }}>
            {String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children as React.ReactNode;
  }
}
