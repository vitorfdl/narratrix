import { z } from "zod";

/**
 * Utility functions for working with dates in Zod schemas
 * These utilities are designed to work with SQLite date storage
 */
export const dateUtils = {
  /**
   * Creates an ISO string date schema with a default value of the current date/time
   * @returns A Zod schema for ISO string dates with default to now
   */
  withDefaultNow: () =>
    z
      .string()
      .datetime()
      .default(() => new Date().toISOString()),

  /**
   * Creates an optional date schema that transforms null to undefined
   * Handles SQLite NULL values appropriately
   * @returns A Zod schema for optional dates
   */
  optional: () =>
    z
      .string()
      .datetime()
      .nullable()
      .transform((val) => (val === null ? undefined : val))
      .optional(),

  /**
   * Parses an ISO string from SQLite to a Date object
   * @returns A Zod schema that transforms ISO strings to Date objects
   */
  fromISOString: () =>
    z
      .string()
      .datetime()
      .transform((dateString) => new Date(dateString)),
};

/**
 * Utility functions for working with UUIDs in Zod schemas
 */
export const uuidUtils = {
  /**
   * Creates a UUID schema with validation
   * @returns A Zod schema for UUID strings
   */
  uuid: () => z.string().uuid(),

  /**
   * Creates a UUID schema with a default value of a new UUID
   * @returns A Zod schema for UUID strings with default to a new UUID
   */
  withDefault: () =>
    z
      .string()
      .uuid()
      .default(() => crypto.randomUUID()),

  /**
   * Creates an optional UUID schema that transforms null to undefined
   * Handles SQLite NULL values appropriately
   * @returns A Zod schema for optional UUIDs
   */
  optional: () =>
    z
      .string()
      .uuid()
      .nullable()
      .transform((val) => (val === null ? undefined : val))
      .optional(),
};
