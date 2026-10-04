import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  props: Props;
  state: State;
  setState: (state: Partial<State> | ((prevState: State) => Partial<State>)) => void;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SPYWAR Uncaught Error:', error, errorInfo);
  }

  public handleRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-zinc-900 border-2 border-rose-500/50 shadow-2xl text-center space-y-4 my-8 max-w-xl mx-auto font-mono">
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Temporary Render Glitch Prevented</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Your match progress has been preserved in session memory.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] text-rose-300 mt-2 bg-rose-950/40 p-2 rounded border border-rose-900/50">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleRecover}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-2 mx-auto transition-all shadow-md active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Resume Match</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
