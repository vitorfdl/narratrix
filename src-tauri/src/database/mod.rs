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
    ]
}
