import { NextResponse } from "next/server"
import type { z, ZodTypeAny } from "zod"

/**
 * Options de validation.
 */
interface ValidateOptions {
  /**
   * Si `false`, les détails d'erreur Zod ne sont pas retournés au client
   * (message générique "Invalid input"). Utile pour les webhooks externes
   * où on ne veut pas leaker la structure attendue du payload.
   * Par défaut `true` (détails retournés — adapté aux routes authentifiées internes).
   */
  publicErrors?: boolean
}

/**
 * Résultat discriminé : soit les données validées, soit une NextResponse 400 prête à return.
 * L'appelant fait `if ("error" in result) return result.error;`
 *
 * Les deux variants ont des clés disjointes (`data` vs `error`), ce qui permet
 * à TypeScript de narrow correctement via l'operateur `in`.
 */
type ValidationResult<T> = { data: T } | { error: NextResponse }

/**
 * Valide le body JSON d'une requête contre un schema Zod.
 *
 * Usage :
 * ```ts
 * const v = await validateBody(req, createEntrySchema)
 * if ("error" in v) return v.error
 * const { data } = v
 * ```
 *
 * Format d'erreur détaillée (default) :
 * ```json
 * {
 *   "error": "Invalid input",
 *   "details": {
 *     "fieldErrors": { "amount": ["Expected number, received string"] },
 *     "formErrors": []
 *   }
 * }
 * ```
 *
 * Format générique (`publicErrors: false`) :
 * ```json
 * { "error": "Invalid input" }
 * ```
 */
export async function validateBody<T extends ZodTypeAny>(
  req: Request,
  schema: T,
  opts: ValidateOptions = {}
): Promise<ValidationResult<z.infer<T>>> {
  const { publicErrors = true } = opts

  // Parse JSON
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return {
      error: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    }
  }

  // Validation Zod
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    if (publicErrors) {
      return {
        error: NextResponse.json(
          {
            error: "Invalid input",
            details: parsed.error.flatten(),
          },
          { status: 400 }
        ),
      }
    }
    return {
      error: NextResponse.json({ error: "Invalid input" }, { status: 400 }),
    }
  }

  return { data: parsed.data }
}

/**
 * Valide les searchParams (query string) d'une requête GET contre un schema Zod.
 *
 * Zod est strict sur les types : comme les searchParams sont toujours des `string`,
 * le schema doit soit les accepter en `z.string()` + transform, soit utiliser `z.coerce.*`
 * pour les conversions (z.coerce.number(), z.coerce.boolean(), z.coerce.date()).
 *
 * Usage :
 * ```ts
 * const url = new URL(req.url)
 * const v = validateSearchParams(url.searchParams, listEntriesSchema)
 * if ("error" in v) return v.error
 * const { data } = v  // data.page est un number, pas une string
 * ```
 */
export function validateSearchParams<T extends ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T,
  opts: ValidateOptions = {}
): ValidationResult<z.infer<T>> {
  const { publicErrors = true } = opts

  // Convertit searchParams en objet plat (les clés dupliquées prennent la dernière valeur)
  const obj: Record<string, string> = {}
  for (const [k, v] of searchParams.entries()) {
    obj[k] = v
  }

  const parsed = schema.safeParse(obj)
  if (!parsed.success) {
    if (publicErrors) {
      return {
        error: NextResponse.json(
          {
            error: "Invalid query parameters",
            details: parsed.error.flatten(),
          },
          { status: 400 }
        ),
      }
    }
    return {
      error: NextResponse.json(
        { error: "Invalid query parameters" },
        { status: 400 }
      ),
    }
  }

  return { data: parsed.data }
}
