"use client"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div
      className="sticky-header -mx-6 md:-mx-8 px-6 md:px-8 mb-6 flex items-center justify-between"
      style={{ padding: "16px 24px" }}
    >
      <div>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "var(--text)",
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.3,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontSize: 12,
              color: "var(--text-dim)",
              marginTop: 2,
              fontFamily: "'DM Sans', sans-serif",
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
