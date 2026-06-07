/**
 * FlowOS mobile - src/web/ErrorBoundary.tsx
 * Web-only dev helper: catches React render errors and prints them on screen so we
 * don't get a silent blank page. Renders a plain <pre> (react-dom root context).
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('App render error:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return React.createElement(
        'pre',
        {
          style: {
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#b91c1c',
            background: '#fff',
            padding: 16,
            margin: 0,
            fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
            fontSize: 12,
            lineHeight: 1.5,
            height: '100%',
            overflow: 'auto',
          },
        },
        String(this.state.error.stack || this.state.error.message || this.state.error),
      );
    }
    return this.props.children;
  }
}
