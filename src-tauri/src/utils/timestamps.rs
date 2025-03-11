use sqlx::{
    query::Query,
    sqlite::{Sqlite, SqliteArguments},
};
use time::OffsetDateTime;

/// Get the current UTC timestamp
pub fn now() -> OffsetDateTime {
    OffsetDateTime::now_utc()
}

/// Add created_at and updated_at timestamps to a new record
///
/// # Arguments
/// * `query` - The SQL query with placeholders for created_at and updated_at
///
/// # Returns
/// * The query with timestamps bound to it
///
/// # Example
/// ```
/// let query = sqlx::query("INSERT INTO table (field1, created_at, updated_at) VALUES (?, ?, ?)");
/// let query = query.bind(value);
/// let query = add_timestamps(query);
/// ```
pub fn add_timestamps<'q>(
    query: Query<'q, Sqlite, SqliteArguments<'q>>,
) -> Query<'q, Sqlite, SqliteArguments<'q>> {
    let timestamp = now();
    query.bind(timestamp).bind(timestamp)
}

/// Add updated_at timestamp to an existing record
///
/// # Arguments
/// * `query` - The SQL query with placeholder for updated_at
///
/// # Returns
/// * The query with timestamp bound to it
///
/// # Example
/// ```
/// let query = sqlx::query("UPDATE table SET field1 = ?, updated_at = ? WHERE id = ?");
/// let query = query.bind(value).bind(id);
/// let query = update_timestamp(query);
/// ```
pub fn update_timestamp<'q>(
    query: Query<'q, Sqlite, SqliteArguments<'q>>,
) -> Query<'q, Sqlite, SqliteArguments<'q>> {
    query.bind(now())
}

/// Helper struct to hold created_at and updated_at timestamps
/// Can be used for new record creation
#[derive(Debug, Clone, Copy)]
pub struct Timestamps {
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

impl Timestamps {
    /// Create new timestamps with both created_at and updated_at set to current time
    pub fn new() -> Self {
        let current_time = now();
        Self {
            created_at: current_time,
            updated_at: current_time,
        }
    }

    /// Create a timestamps struct for updates (only updated_at is set to current time)
    pub fn for_update(created_at: OffsetDateTime) -> Self {
        Self {
            created_at,
            updated_at: now(),
        }
    }

    /// Add both timestamps to a query
    pub fn add_to_query<'q>(
        &self,
        query: Query<'q, Sqlite, SqliteArguments<'q>>,
    ) -> Query<'q, Sqlite, SqliteArguments<'q>> {
        query.bind(self.created_at).bind(self.updated_at)
    }

    /// Add only the updated_at timestamp to a query
    pub fn add_update_to_query<'q>(
        &self,
        query: Query<'q, Sqlite, SqliteArguments<'q>>,
    ) -> Query<'q, Sqlite, SqliteArguments<'q>> {
        query.bind(self.updated_at)
    }
}
