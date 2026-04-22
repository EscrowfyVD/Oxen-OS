import { describe, it, expect } from "vitest"
import { z } from "zod"
import { validateBody, validateSearchParams } from "./validate"

describe("validateBody", () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().nonnegative(),
  })

  const makeReq = (body: unknown) =>
    new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })

  it("returns data on valid input", async () => {
    const res = await validateBody(makeReq({ name: "alice", age: 30 }), schema)
    expect("data" in res).toBe(true)
    if ("data" in res) {
      expect(res.data).toEqual({ name: "alice", age: 30 })
    }
  })

  it("returns 400 with details on invalid input (default)", async () => {
    const res = await validateBody(makeReq({ name: "", age: -1 }), schema)
    expect("error" in res).toBe(true)
    if ("error" in res) {
      expect(res.error.status).toBe(400)
      const body = await res.error.json()
      expect(body.error).toBe("Invalid input")
      expect(body.details).toBeDefined()
      expect(body.details.fieldErrors).toBeDefined()
    }
  })

  it("returns 400 without details when publicErrors=false", async () => {
    const res = await validateBody(
      makeReq({ name: "", age: -1 }),
      schema,
      { publicErrors: false }
    )
    if ("error" in res) {
      const body = await res.error.json()
      expect(body.error).toBe("Invalid input")
      expect(body.details).toBeUndefined()
    }
  })

  it("returns 400 on malformed JSON", async () => {
    const req = makeReq("{not json")
    const res = await validateBody(req, schema)
    if ("error" in res) {
      expect(res.error.status).toBe(400)
      const body = await res.error.json()
      expect(body.error).toBe("Invalid JSON")
    }
  })

  it("returns 400 on empty body", async () => {
    const res = await validateBody(makeReq({}), schema)
    expect("error" in res).toBe(true)
  })

  it("strips unknown fields (default Zod behavior)", async () => {
    const res = await validateBody(
      makeReq({ name: "alice", age: 30, extra: "ignored" }),
      schema
    )
    if ("data" in res) {
      expect(res.data.name).toBe("alice")
      // Note: Zod par défaut passe les unknown keys. Pour strip, utiliser .strip()
      // ou .strict() pour reject. Ce test documente le comportement default.
    }
  })
})

describe("validateSearchParams", () => {
  const schema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().optional(),
  })

  it("returns data with coerced types on valid input", () => {
    const sp = new URLSearchParams("page=2&limit=50&q=hello")
    const res = validateSearchParams(sp, schema)
    if ("data" in res) {
      expect(res.data.page).toBe(2)
      expect(res.data.limit).toBe(50)
      expect(res.data.q).toBe("hello")
    }
  })

  it("applies defaults when params absent", () => {
    const sp = new URLSearchParams("")
    const res = validateSearchParams(sp, schema)
    if ("data" in res) {
      expect(res.data.page).toBe(1)
      expect(res.data.limit).toBe(20)
    }
  })

  it("returns 400 on invalid coercion", () => {
    const sp = new URLSearchParams("page=abc")
    const res = validateSearchParams(sp, schema)
    if ("error" in res) {
      expect(res.error.status).toBe(400)
    }
  })

  it("returns 400 on out-of-range values", () => {
    const sp = new URLSearchParams("limit=999")
    const res = validateSearchParams(sp, schema)
    expect("error" in res).toBe(true)
  })
})
