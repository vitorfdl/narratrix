import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import React from "react";
import { LuCopy, LuRefreshCw, LuTriangleAlert } from "react-icons/lu";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  /** Names the region in the fallback title, e.g. "Chat" */
  label?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Catches render errors in the wrapped region and shows a copyable report
 * instead of unmounting the whole app into a blank screen.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  private buildReport(): string {
    const { error, componentStack } = this.state;
    return [`${error?.name}: ${error?.message}`, error?.stack, componentStack && `Component stack:${componentStack}`].filter(Boolean).join("\n\n");
  }

  private handleCopy = async () => {
    try {
      await writeText(this.buildReport());
    } catch (copyError) {
      console.error("Failed to copy error report:", copyError);
    }
  };

  private handleRetry = () => {
    this.setState({ error: null, componentStack: null });
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <LuTriangleAlert className="h-4 w-4 flex-shrink-0" />
            <h2 className="text-sm font-semibold">{this.props.label ? `${this.props.label} failed to render` : "Something failed to render"}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            The rest of the app keeps working. Copy the details below and share them in the bug report, then press Try Again — if it keeps failing, restart the app.
          </p>
          <pre className="custom-scrollbar max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-background/60 p-2 font-mono text-[11px] text-foreground/80">{this.buildReport()}</pre>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={this.handleCopy}>
              <LuCopy className="!size-3" /> Copy Details
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7" onClick={this.handleRetry}>
              <LuRefreshCw className="!size-3" /> Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
