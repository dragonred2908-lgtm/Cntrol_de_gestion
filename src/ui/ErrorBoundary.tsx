import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Captura errores de render de la SPA y evita la pantalla en blanco.
 */
export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ui] Error no controlado:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)]">
        <div className="card p-6 max-w-md w-full text-center">
          <div className="mx-auto w-10 h-10 rounded-lg border border-[var(--line)] bg-[var(--panel-2)] flex items-center justify-center">
            <AlertTriangle size={18} className="text-[var(--txt-2)]" />
          </div>
          <h1 className="text-[16px] font-semibold text-[var(--txt)] mt-3">Algo salió mal</h1>
          <p className="text-[12.5px] text-[var(--txt-2)] mt-1">
            La consola encontró un error inesperado. Recargá para volver a operar.
          </p>
          <pre className="mono text-[10.5px] text-[var(--txt-3)] mt-3 text-left overflow-auto max-h-32 p-2 rounded border border-[var(--line)]">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="btn btn-primary w-full mt-4"
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={14} /> Recargar
          </button>
        </div>
      </div>
    );
  }
}
