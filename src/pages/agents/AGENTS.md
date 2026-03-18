The biggest speed-up is giving node requests in the repo’s native shape, not just in product terms.

For this codebase, the most useful information is:

- **Node role**: is it `script`, `tool`, `chat`, `trigger`, `history`, or something hybrid?
- **Inputs/outputs**: exact handles, edge types, and whether outputs are static or dynamic by config.
- **Execution behavior**: what the executor should return, where it should read input from, and whether it pauses, streams, logs, writes chat messages, or calls tools.
- **Runtime dependencies**: whether it needs `chatStore`, `consoleStore`, inference deps, a new Zustand store, or just pure workflow data.
- **UI expectations**: what the node body should preview, what the config dialog should expose, and what must be hidden/disabled depending on mode.
- **Override rules**: if connected inputs replace config values, merge with them, or only act as fallback.
- **User-facing validation**: expected JSON/input formats, required fields, cancellation behavior, timeout behavior, and error messages.
- **Output consumption**: whether downstream nodes read a plain string, toolset, structured object, or handle-scoped values.

What I learned that matters most for future nodes:

- Every node should follow the same file structure as the existing node files.
- New nodes usually require touching **multiple integration points**, not just one file:
  - `node file`
  - `tool-nodes/index.ts`
  - `handles.ts`
  - sometimes `runner.ts`
  - sometimes a UI component/store outside the agent editor
- **Dynamic outputs** are important here. If a node changes outputs by mode/config, it should use `getDynamicOutputs`.
- If a node needs to **pause execution waiting for UI**, it needs a store bridge between executor code and React UI.
- Cancellation must be handled explicitly, especially for anything async or user-driven.
- If a node accepts **JSON input**, the format must be documented in both the config dialog and the node body/help tooltip.
- The node preview should always make clear when **connected inputs override local config**.