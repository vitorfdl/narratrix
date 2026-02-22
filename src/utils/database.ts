import Database, { QueryResult } from "@tauri-apps/plugin-sql";
import { formatDateTime } from "./date-time";

// Database connection singleton
let db: Database | null = null;

// Database configuration
const DB_URL = "sqlite:narratrix_main.db";

/**
 * Initializes and returns a database connection
 * Maintains a singleton pattern to avoid multiple connections
 */
export async function getDatabase(): Promise<Database> {
  if (!db) {
    try {
      db = await Database.load(DB_URL);
      // Enable foreign key constraints
      await db.execute("PRAGMA foreign_keys = ON;");
    } catch (error) {
      console.error("Failed to connect to database:", error);
      throw new Error("Database connection failed");
    }
  }
  return db;
}

/**
 * Executes a database query with proper error handling
 */
export async function executeDBQuery(query: string, params: any[] = []): Promise<QueryResult> {
  const database = await getDatabase();
  try {
    return await database.execute(query, params);
  } catch (error) {
    console.error("Query execution error:", error);
    throw error;
  }
}

/**
 * Performs a select query with proper error handling
 */
export async function selectDBQuery<T>(query: string, params: any[] = []): Promise<T> {
  const database = await getDatabase();
  try {
    return await database.select<T>(query, params);
  } catch (error) {
    console.error("Select query error:", error);
    throw error;
  }
}

interface UpdateQueryBuilder {
  updates: string[];
  values: any[];
  paramIndex: number;
  whereClause: string;
}

/**
 * Builds a query for updating a record
 */
export function buildUpdateParams<T extends Record<string, any>>(
  id: string,
  updateData: Partial<T>,
  fieldMapping: Partial<Record<keyof T, (value: any) => any>> = {},
  options: {
    skipTimestamp?: boolean;
  } = {},
): UpdateQueryBuilder {
  const builder: UpdateQueryBuilder = {
    updates: [],
    values: [],
    paramIndex: 1,
    whereClause: "",
  };

  for (const [key, value] of Object.entries(updateData)) {
    if (value !== undefined) {
      // Skip undefined values
      const transformedValue = key in fieldMapping ? fieldMapping[key]!(value) : value;
      const sqlValue = typeof transformedValue === "boolean" ? (transformedValue ? 1 : 0) : transformedValue;
      builder.updates.push(`${key.toLowerCase()} = $${builder.paramIndex}`);
      builder.values.push(sqlValue);
      builder.paramIndex++;
    }
  }

  // Automatically add updated_at timestamp unless explicitly skipped
  if (!options.skipTimestamp) {
    builder.updates.push(`updated_at = $${builder.paramIndex}`);
    builder.values.push(formatDateTime());
    builder.paramIndex++;
  }

  // Add WHERE clause if ID field is provided
  builder.whereClause = ` WHERE id = $${builder.paramIndex}`;
  builder.values.push(id);

  return builder;
}
