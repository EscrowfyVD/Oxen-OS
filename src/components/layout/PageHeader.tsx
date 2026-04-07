"use client"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div
      className="sticky-header flex items-center justify-between"
      style={{
        padding: "16px 32px",
        background: "var(--header-bg)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--card-border)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: "'Bellfair', serif",
            fontSize: 28,
            fontWeight: 400,
            color: "var(--text-primary)",
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              marginTop: 4,
              fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.4,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
