import { describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("database integration prerequisites", () => {
  it("receives a configured test database URL", () => expect(process.env.DATABASE_URL).toMatch(/^postgresql:\/\//));
});

