"use client";

import { Component, type ReactNode } from "react";

import { EmptyState } from "@/components/ChartPanel";
import { Button } from "@/components/ui/Button";

/**
 * Aísla los fallos de render de una vista: si una gráfica revienta con datos
 * inesperados, el resto de la app (cabecera, selector) sigue funcionando.
 */
export class ViewErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[DeltaZero] Error en la vista:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <EmptyState
          tone="error"
          message="Algo ha fallado al dibujar esta vista"
          hint={this.state.error.message}
          action={
            <Button variant="secondary" size="sm" onClick={() => this.setState({ error: null })}>
              Reintentar
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
