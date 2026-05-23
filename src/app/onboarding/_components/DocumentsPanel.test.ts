// Smoke tests for DocumentsPanel. No DOM render harness in the repo
// (the existing onboarding tests live at the format / detail-types
// boundary), so we exercise the type contract + the render-shape
// invariants via React's renderToStaticMarkup — same approach we'd
// use for any other server-renderable component, no test-renderer
// dependency added.

import { describe, it, expect } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import DocumentsPanel from "./DocumentsPanel"
import type { DocumentRow } from "./detail-types"

function html(documents: DocumentRow[] | null): string {
  return renderToStaticMarkup(createElement(DocumentsPanel, { documents }))
}

describe("DocumentsPanel", () => {
  it("renders empty state when documents is null", () => {
    const out = html(null)
    expect(out).toContain("No documents uploaded yet")
  })

  it("renders empty state when documents array is empty", () => {
    const out = html([])
    expect(out).toContain("No documents uploaded yet")
  })

  it("renders one row per document with file_name + doc_type", () => {
    const out = html([
      {
        id: "d1",
        file_name: "passport.pdf",
        doc_type: "passport",
        validation_status: "validated",
        processing_status: "done",
        extraction_failed: false,
        created_at: "2026-05-20T10:00:00Z",
      },
      {
        id: "d2",
        file_name: "incorporation.pdf",
        doc_type: "incorporation_doc",
      },
    ])
    expect(out).toContain("passport.pdf")
    expect(out).toContain("passport")
    expect(out).toContain("incorporation.pdf")
    expect(out).toContain("incorporation_doc")
    // No "No documents" empty-state copy when rows are present.
    expect(out).not.toContain("No documents uploaded yet")
  })

  it("shows extraction-failed pill when extraction_failed=true", () => {
    const out = html([
      {
        id: "d1",
        file_name: "scan.pdf",
        extraction_failed: true,
      },
    ])
    expect(out).toContain("extraction failed")
  })

  it("omits the extraction-failed pill when extraction_failed is falsy/missing", () => {
    const out = html([
      { id: "d1", file_name: "ok.pdf", extraction_failed: false },
      { id: "d2", file_name: "missing.pdf" },
    ])
    expect(out).not.toContain("extraction failed")
  })

  it("renders validation_status + processing_status pills when present", () => {
    const out = html([
      {
        id: "d1",
        file_name: "scan.pdf",
        validation_status: "validated",
        processing_status: "done",
      },
    ])
    expect(out).toContain("validated")
    expect(out).toContain("done")
  })

  it("renders defensively when only file_name is set (all other fields missing)", () => {
    const out = html([{ id: "d1", file_name: "minimal.pdf" }])
    expect(out).toContain("minimal.pdf")
    // Should not throw — and should not invent dashes or "(none)" for
    // missing optional fields; they just don't appear.
  })
})
