# Security utils

```typescript
import { invoke } from "@tauri-apps/api/tauri";

// Hash a password
const hashedPassword = await invoke("hash_password", {
  password: "user_password",
});

// Verify a password
const isValid = await invoke("verify_password", {
  password: "user_password",
  hash: hashedPassword,
});
```
