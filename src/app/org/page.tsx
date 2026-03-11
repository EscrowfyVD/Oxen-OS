"use client"

import { useEffect, useState } from "react"
import PageHeader from "@/components/layout/PageHeader"

/* ── Design tokens ── */
const FROST = "#FFFFFF"
const CARD_BG = "#0F1118"
const CARD_BORDER = "rgba(255,255,255,0.06)"
const TEXT_PRIMARY = "#F0F0F2"
const TEXT_SECONDARY = "rgba(240,240,242,0.55)"
const TEXT_TERTIARY = "rgba(240,240,242,0.3)"
const ROSE_GOLD = "#C08B88"
const GREEN = "#34D399"
const AMBER = "#FBBF24"
const INDIGO = "#818CF8"

/* ── Types ── */
interface OrgEntity {
  id: string
  name: string
  jurisdiction: string | null
  type: string
  parentId: string | null
  order: number
}

interface EntityForm {
  name: string
  jurisdiction: string
  type: string
  parentId: string | null
}

const LEGEND_ITEMS = [
  { label: "SRO Regulated (CH)", color: GREEN },
  { label: "MSB / FINTRAC (CA)", color: INDIGO },
  { label: "VASP Italy", color: AMBER },
  { label: "MiCA (planned)", color: TEXT_TERTIARY },
]

const emptyForm = (): EntityForm => ({
  name: "",
  jurisdiction: "",
  type: "Operating Entity",
  parentId: null,
})

export default function OrgPage() {
  const [entities, setEntities] = useState<OrgEntity[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EntityForm>(emptyForm())
  const [addingTo, setAddingTo] = useState<string | null | "root">(null)
  const [addForm, setAddForm] = useState<EntityForm>(emptyForm())

  const fetchEntities = () => {
    fetch("/api/org-entities")
      .then((r) => r.json())
      .then((data) => setEntities(data.entities ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    fetchEntities()
  }, [])

  const roots = entities.filter((e) => e.parentId === null)
  const getChildren = (parentId: string) =>
    entities.filter((e) => e.parentId === parentId)

  /* ── CRUD handlers ── */
  const handleCreate = async (parentId: string | null) => {
    const form = addForm
    if (!form.name.trim()) return
    try {
      await fetch("/api/org-entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          jurisdiction: form.jurisdiction || null,
          type: form.type || "Operating Entity",
          parentId: parentId,
        }),
      })
      setAddingTo(null)
      setAddForm(emptyForm())
      fetchEntities()
    } catch {
      // silent
    }
  }

  const handleEdit = async (id: string) => {
    if (!editForm.name.trim()) return
    try {
      await fetch(`/api/org-entities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          jurisdiction: editForm.jurisdiction || null,
          type: editForm.type || "Operating Entity",
          parentId: editForm.parentId,
        }),
      })
      setEditingId(null)
      setEditForm(emptyForm())
      fetchEntities()
    } catch {
      // silent
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/org-entities/${id}`, { method: "DELETE" })
      fetchEntities()
    } catch {
      // silent
    }
  }

  const startEdit = (entity: OrgEntity) => {
    setEditingId(entity.id)
    setEditForm({
      name: entity.name,
      jurisdiction: entity.jurisdiction ?? "",
      type: entity.type,
      parentId: entity.parentId,
    })
    setAddingTo(null)
  }

  const startAdd = (parentId: string | null) => {
    setAddingTo(parentId === null ? "root" : parentId)
    setAddForm(emptyForm())
    setEditingId(null)
  }

  /* ── Inline form component ── */
  const inputStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 6,
    border: `1px solid rgba(192,139,136,0.25)`,
    background: "rgba(255,255,255,0.04)",
    color: TEXT_PRIMARY,
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    width: "100%",
    outline: "none",
    transition: "border-color 0.2s ease",
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    color: TEXT_TERTIARY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 3,
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
  }

  const renderForm = (
    form: EntityForm,
    setForm: (f: EntityForm) => void,
    onSave: () => void,
    onCancel: () => void
  ) => (
    <div
      style={{
        background: CARD_BG,
        border: `1px solid rgba(192,139,136,0.25)`,
        borderRadius: 10,
        padding: 14,
        minWidth: 200,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div>
        <div style={labelStyle}>Name</div>
        <input
          style={inputStyle}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Entity name"
          autoFocus
        />
      </div>
      <div>
        <div style={labelStyle}>Jurisdiction</div>
        <input
          style={inputStyle}
          value={form.jurisdiction}
          onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
          placeholder="e.g. Switzerland"
        />
      </div>
      <div>
        <div style={labelStyle}>Type / License</div>
        <input
          style={inputStyle}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          placeholder="e.g. Holding"
        />
      </div>
      <div>
        <div style={labelStyle}>Parent</div>
        <select
          style={{ ...inputStyle, cursor: "pointer", appearance: "none" as const }}
          value={form.parentId ?? ""}
          onChange={(e) =>
            setForm({ ...form, parentId: e.target.value || null })
          }
        >
          <option value="">None (root)</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>
              {ent.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button
          onClick={onSave}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            border: "none",
            background: GREEN,
            color: "#060709",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 0.2s",
          }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            border: `1px solid ${CARD_BORDER}`,
            background: "transparent",
            color: TEXT_SECONDARY,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
            transition: "opacity 0.2s",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )

  /* ── OrgNode view/edit ── */
  const renderNode = (entity: OrgEntity) => {
    const isRoot = entity.parentId === null
    const children = getChildren(entity.id)
    const isEditing = editingId === entity.id
    const isHolding =
      entity.type.toLowerCase().includes("holding") || isRoot

    if (isEditing) {
      return (
        <div
          key={entity.id}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {renderForm(
            editForm,
            setEditForm,
            () => handleEdit(entity.id),
            () => {
              setEditingId(null)
              setEditForm(emptyForm())
            }
          )}
          {children.length > 0 && (
            <>
              <div
                style={{
                  width: 1,
                  height: 24,
                  background: "rgba(192,139,136,0.2)",
                }}
              />
              {renderChildren(entity.id)}
            </>
          )}
        </div>
      )
    }

    return (
      <div
        key={entity.id}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Node card */}
        <div
          style={{
            position: "relative",
            background: isHolding
              ? "rgba(192,139,136,0.06)"
              : CARD_BG,
            border: `1px solid ${
              isRoot ? "rgba(192,139,136,0.2)" : CARD_BORDER
            }`,
            borderRadius: 10,
            padding: "14px 18px",
            minWidth: 180,
            maxWidth: 240,
            textAlign: "center",
            cursor: "default",
            transition: "all 0.25s ease",
            overflow: "hidden",
          }}
          onMouseEnter={(e) => {
            const card = e.currentTarget
            card.style.borderColor = "rgba(192,139,136,0.3)"
            card.style.transform = "translateY(-2px)"
            card.style.boxShadow = "0 12px 40px rgba(0,0,0,0.4)"
            const actions = card.querySelector(
              "[data-actions]"
            ) as HTMLElement | null
            if (actions) actions.style.opacity = "1"
          }}
          onMouseLeave={(e) => {
            const card = e.currentTarget
            card.style.borderColor = isRoot
              ? "rgba(192,139,136,0.2)"
              : CARD_BORDER
            card.style.transform = "translateY(0)"
            card.style.boxShadow = "none"
            const actions = card.querySelector(
              "[data-actions]"
            ) as HTMLElement | null
            if (actions) actions.style.opacity = "0"
          }}
        >
          {/* Root gradient line */}
          {isRoot && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: `linear-gradient(90deg, transparent, ${ROSE_GOLD}, transparent)`,
              }}
            />
          )}

          {/* Action buttons */}
          <div
            data-actions=""
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              display: "flex",
              gap: 4,
              opacity: 0,
              transition: "opacity 0.2s ease",
            }}
          >
            <button
              onClick={() => startEdit(entity)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                border: `1px solid ${CARD_BORDER}`,
                background: "rgba(255,255,255,0.04)",
                color: TEXT_SECONDARY,
                fontSize: 10,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
                fontFamily: "'DM Sans', sans-serif",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor =
                  "rgba(192,139,136,0.4)"
                e.currentTarget.style.color = ROSE_GOLD
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = CARD_BORDER
                e.currentTarget.style.color = TEXT_SECONDARY
              }}
              title="Edit entity"
            >
              {"\u270E"}
            </button>
            {!isRoot && (
              <button
                onClick={() => handleDelete(entity.id)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  border: "1px solid rgba(248,113,113,0.2)",
                  background: "rgba(248,113,113,0.06)",
                  color: "#F87171",
                  fontSize: 10,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(248,113,113,0.15)"
                  e.currentTarget.style.borderColor =
                    "rgba(248,113,113,0.4)"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "rgba(248,113,113,0.06)"
                  e.currentTarget.style.borderColor =
                    "rgba(248,113,113,0.2)"
                }}
                title="Delete entity"
              >
                {"\u2715"}
              </button>
            )}
          </div>

          {/* Entity name */}
          <div
            style={{
              fontFamily: "'Bellfair', serif",
              fontSize: isRoot ? 18 : 15,
              color: FROST,
              fontWeight: 400,
              lineHeight: 1.3,
              marginBottom: 4,
            }}
          >
            {entity.name}
          </div>

          {/* Jurisdiction */}
          {entity.jurisdiction && (
            <div
              style={{
                fontSize: 10,
                color: TEXT_TERTIARY,
                textTransform: "uppercase",
                letterSpacing: 1,
                fontFamily: "'DM Sans', sans-serif",
                marginBottom: 6,
              }}
            >
              {entity.jurisdiction}
            </div>
          )}

          {/* Type badge */}
          <div
            style={{
              display: "inline-block",
              fontSize: 9,
              padding: "2px 8px",
              borderRadius: 10,
              background: isHolding
                ? "rgba(192,139,136,0.15)"
                : "rgba(255,255,255,0.05)",
              color: isHolding ? ROSE_GOLD : TEXT_SECONDARY,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            {entity.type}
          </div>
        </div>

        {/* Add child button */}
        <button
          onClick={() => startAdd(entity.id)}
          style={{
            marginTop: 8,
            padding: "4px 12px",
            borderRadius: 6,
            border: `1px dashed rgba(192,139,136,0.2)`,
            background: "transparent",
            color: TEXT_TERTIARY,
            fontSize: 9,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "rgba(192,139,136,0.4)"
            e.currentTarget.style.color = ROSE_GOLD
            e.currentTarget.style.background = "rgba(192,139,136,0.06)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(192,139,136,0.2)"
            e.currentTarget.style.color = TEXT_TERTIARY
            e.currentTarget.style.background = "transparent"
          }}
        >
          + Add child
        </button>

        {/* Children */}
        {(children.length > 0 || addingTo === entity.id) && (
          <>
            <div
              style={{
                width: 1,
                height: 24,
                background: "rgba(192,139,136,0.2)",
              }}
            />
            {renderChildren(entity.id)}
          </>
        )}
      </div>
    )
  }

  const renderChildren = (parentId: string) => {
    const children = getChildren(parentId)
    const showAddForm = addingTo === parentId
    const totalItems = children.length + (showAddForm ? 1 : 0)

    if (totalItems === 0) return null

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Horizontal connector line */}
        {totalItems > 1 && (
          <div
            style={{
              height: 1,
              background: "rgba(192,139,136,0.15)",
              alignSelf: "stretch",
              marginLeft: 40,
              marginRight: 40,
            }}
          />
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 20,
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          {children.map((child) => (
            <div
              key={child.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {/* Vertical connector from horizontal line to child node */}
              {totalItems > 1 && (
                <div
                  style={{
                    width: 1,
                    height: 24,
                    background: "rgba(192,139,136,0.2)",
                  }}
                />
              )}
              {renderNode(child)}
            </div>
          ))}

          {/* Add form at end of children */}
          {showAddForm && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {totalItems > 1 && (
                <div
                  style={{
                    width: 1,
                    height: 24,
                    background: "rgba(192,139,136,0.2)",
                  }}
                />
              )}
              {renderForm(
                addForm,
                setAddForm,
                () => handleCreate(parentId),
                () => {
                  setAddingTo(null)
                  setAddForm(emptyForm())
                }
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <PageHeader
        title="Legal Structure"
        description="Corporate organigramme — click ✎ to edit, hover for actions"
        actions={
          <button className="header-btn" onClick={() => startAdd(null)}>
            + Add Root Entity
          </button>
        }
      />

      {/* Tree area */}
      <div
        style={{
          padding: "40px 20px",
          overflowX: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        {roots.length === 0 && addingTo !== "root" && (
          <div
            style={{
              padding: "64px 0",
              textAlign: "center",
              color: TEXT_TERTIARY,
            }}
          >
            <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 12 }}>
              {"\u2B21"}
            </div>
            <div
              style={{
                fontSize: 13,
                fontFamily: "'DM Sans', sans-serif",
                color: TEXT_SECONDARY,
              }}
            >
              No entities yet
            </div>
            <div
              style={{
                fontSize: 11,
                fontFamily: "'DM Sans', sans-serif",
                color: TEXT_TERTIARY,
                marginTop: 4,
              }}
            >
              Click + Add Root Entity to get started
            </div>
          </div>
        )}

        {/* Root-level add form */}
        {addingTo === "root" && (
          <div style={{ marginBottom: 20 }}>
            {renderForm(
              addForm,
              setAddForm,
              () => handleCreate(null),
              () => {
                setAddingTo(null)
                setAddForm(emptyForm())
              }
            )}
          </div>
        )}

        {/* Render root entities */}
        {roots.map((root) => (
          <div
            key={root.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {renderNode(root)}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{
          marginTop: 40,
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 12,
          padding: "14px 20px",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: TEXT_TERTIARY,
            fontFamily: "'DM Sans', sans-serif",
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 500,
            marginRight: 4,
          }}
        >
          Legend
        </span>
        {LEGEND_ITEMS.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: item.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: TEXT_SECONDARY,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
