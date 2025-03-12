import Database, { QueryResult } from "@tauri-apps/plugin-sql";

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
      console.log("Database connection established");
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
export async function executeDBQuery(
  query: string,
  params: any[] = [],
): Promise<QueryResult> {
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
export async function selectDBQuery<T>(
  query: string,
  params: any[] = [],
): Promise<T> {
  const database = await getDatabase();
  try {
    return await database.select<T>(query, params);
  } catch (error) {
    console.error("Select query error:", error);
    throw error;
  }
}
