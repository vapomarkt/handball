/**
 * Single source of truth: re-exports the framework-free domain layer of the
 * web/core app (pure TypeScript + Zod, guarded by tests/unit/architecture-purity.test.ts).
 *
 * Core development keeps editing `src/domain/**` as usual – web and mobile
 * automatically share the same schemas, enums and DTO types.
 */
export * from "../../../src/domain/schemas/handball";
export * from "../../../src/domain/schemas/event";
export * from "../../../src/domain/schemas/member";
export * from "../../../src/domain/schemas/invite";
export * from "../../../src/domain/schemas/community";
export * from "../../../src/domain/schemas/carpool";
export * from "../../../src/domain/schemas/duty";
export * from "../../../src/domain/schemas/tactic";
export * from "../../../src/domain/schemas/league-catalog";
export * from "../../../src/domain/schemas/jersey-set";
