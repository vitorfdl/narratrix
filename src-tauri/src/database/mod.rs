use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 01,
            description: "create_profiles",
            sql: include_str!("./migrations/01_create_profiles.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 02,
            description: "create_templates",
            sql: include_str!("./migrations/02_create_templates.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 03,
            description: "create_models",
            sql: include_str!("./migrations/03_create_models.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 04,
            description: "create_characters",
            sql: include_str!("./migrations/04_create_characters.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 05,
            description: "create_chats",
            sql: include_str!("./migrations/05_create_chats.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 06,
            description: "create_messages",
            sql: include_str!("./migrations/06_create_messages.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 07,

            description: "create_lorebooks",
            sql: include_str!("./migrations/07_lorebooks.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 08,
            description: "message_extra",
            sql: include_str!("./migrations/08_message_extra.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 09,
            description: "quick_actions",
            sql: include_str!("./migrations/09_profile_quick_btn.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "create_agents",
            sql: include_str!("./migrations/10_create_agents.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "favorite_column",
            sql: include_str!("./migrations/11_favorite_column.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "create_chat_memories",
            sql: include_str!("./migrations/12_create_chat_memories.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
