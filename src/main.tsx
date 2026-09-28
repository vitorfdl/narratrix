// src/main.tsx
import ReactDOM from "react-dom/client";
import { toast } from "sonner";
import App from "./App.tsx";
import "./index.css";

// Surface otherwise-silent failures (a rejected data load leaves the UI blank
// with no trace). Deduped so a rejection loop doesn't flood the toaster.
let lastErrorReport = "";
let lastErrorAt = 0;

function reportGlobalError(source: string, reason: unknown) {
  const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
  console.error(`[${source}]`, reason);
  const now = Date.now();
  if (message === lastErrorReport && now - lastErrorAt < 5000) {
    return;
  }
  lastErrorReport = message;
  lastErrorAt = now;
  toast.error(`Unexpected error (${source})`, { description: message, duration: 15000 });
}

window.addEventListener("unhandledrejection", (event) => {
  reportGlobalError("async", event.reason);
});

window.addEventListener("error", (event) => {
  reportGlobalError("runtime", event.error ?? event.message);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  // <React.StrictMode>
  <App />,
  // </React.StrictMode>,
);
