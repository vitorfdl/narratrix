# Timestamp Utilities

This module provides utility functions and structures for handling timestamps in
database operations, particularly for managing `created_at` and `updated_at`
fields.

## Basic Usage

### Getting Current Time

```rust
use crate::utils::now;

let current_time = now(); // Returns current UTC time as OffsetDateTime
```

### Adding Timestamps to Queries (Simple Method)

For simple queries where you just need to bind timestamps:

```rust
use crate::utils::{add_timestamps, update_timestamp};

// For new records (adds both created_at and updated_at)
let query = sqlx::query("INSERT INTO table (field1, created_at, updated_at) VALUES (?, ?, ?)");
let query = query.bind(value);
let query = add_timestamps(query); // Binds current time to both created_at and updated_at

// For updates (adds only updated_at)
let query = sqlx::query("UPDATE table SET field1 = ?, updated_at = ? WHERE id = ?");
let query = query.bind(value);
let query = update_timestamp(query); // Binds current time to updated_at
query = query.bind(id);
```

### Using the Timestamps Struct (Recommended)

The `Timestamps` struct provides more flexibility and clarity:

```rust
use crate::utils::Timestamps;

// For new records
let timestamps = Timestamps::new(); // Sets both created_at and updated_at to current time

// In insert queries:
let query = sqlx::query("INSERT INTO table (field1, created_at, updated_at) VALUES (?, ?, ?)");
let query = query.bind(value);
// Either use individual fields:
let query = query.bind(timestamps.created_at).bind(timestamps.updated_at);
// Or use the helper method:
let query = timestamps.add_to_query(query);

// For updates (preserving original created_at)
let timestamps = Timestamps::for_update(existing_record.created_at);
let query = sqlx::query("UPDATE table SET field1 = ?, updated_at = ? WHERE id = ?");
let query = query.bind(value);
// Either:
let query = query.bind(timestamps.updated_at);
// Or:
let query = timestamps.add_update_to_query(query);
query = query.bind(id);

// You can also access the timestamps when creating response objects
response.created_at = timestamps.created_at;
response.updated_at = timestamps.updated_at;
```

## Best Practices

1. Use the `Timestamps` struct for better code readability and consistency
2. For updates, always preserve the original `created_at` timestamp
3. Ensure all your tables have `created_at` and `updated_at` columns
4. Use `Timestamps::for_update()` to properly update records
