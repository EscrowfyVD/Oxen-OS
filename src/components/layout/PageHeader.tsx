"use client"

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="sticky-header -mx-6 md:-mx-8 px-6 md:px-8 py-4 mb-6 flex items-center justify-between">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--text)", fontFamily: "'DM Sans', sans-serif" }}
        >
          {title}
        </h1>
        {description && (
          <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
