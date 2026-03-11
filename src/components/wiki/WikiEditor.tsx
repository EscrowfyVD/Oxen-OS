"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import CodeBlock from "@tiptap/extension-code-block"
import Placeholder from "@tiptap/extension-placeholder"
import { useEffect, useCallback } from "react"
import type { JSONContent } from "@tiptap/react"

interface WikiEditorProps {
  content?: JSONContent
  onChange?: (content: JSONContent) => void
  placeholder?: string
}

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
  title?: string
}

function ToolbarButton({ onClick, active, children, title }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: "6px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        border: "none",
        background: active ? "var(--rose-dim)" : "transparent",
        color: active ? "var(--rose)" : "var(--text-mid)",
        fontFamily: "'DM Sans', sans-serif",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent"
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: "var(--border)",
        margin: "0 4px",
      }}
    />
  )
}

export default function WikiEditor({
  content,
  onChange,
  placeholder = "Start writing...",
}: WikiEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          style: "color: var(--blue); text-decoration: underline;",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          style: "max-width: 100%; border-radius: 10px; margin: 8px 0; border: 1px solid var(--border);",
        },
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          style:
            "background: var(--bg-input); border: 1px solid var(--border); border-radius: 10px; padding: 16px; font-family: monospace; font-size: 13px; color: var(--text); overflow-x: auto;",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: content ?? undefined,
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getJSON())
    },
    editorProps: {
      attributes: {
        style:
          "min-height: 300px; outline: none; color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 14px; line-height: 1.7;",
      },
    },
  })

  useEffect(() => {
    if (editor && content && !editor.isDestroyed) {
      const currentJSON = JSON.stringify(editor.getJSON())
      const newJSON = JSON.stringify(content)
      if (currentJSON !== newJSON) {
        editor.commands.setContent(content)
      }
    }
  }, [content, editor])

  const addLink = useCallback(() => {
    if (!editor) return
    const url = window.prompt("Enter URL:")
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  const addImage = useCallback(() => {
    if (!editor) return
    const url = window.prompt("Enter image URL:")
    if (url) {
      editor.chain().focus().setImage({ src: url }).run()
    }
  }, [editor])

  if (!editor) return null

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 flex-wrap"
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-elevated)",
        }}
      >
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          {"\u2022"} List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Ordered List"
        >
          1. List
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code Block"
        >
          {"</>"}
        </ToolbarButton>
        <ToolbarButton onClick={addLink} title="Add Link">
          {"\uD83D\uDD17"}
        </ToolbarButton>
        <ToolbarButton onClick={addImage} title="Add Image">
          {"\uD83D\uDDBC\uFE0F"}
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Blockquote"
        >
          {"\u201C"}
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Rule"
        >
          {"---"}
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div style={{ padding: 16 }}>
        <style>{`
          .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: var(--text-dim);
            opacity: 0.5;
            pointer-events: none;
            height: 0;
          }
          .ProseMirror h1 { font-size: 1.75em; font-weight: 700; margin: 0.75em 0 0.5em; color: var(--text); }
          .ProseMirror h2 { font-size: 1.4em; font-weight: 600; margin: 0.75em 0 0.5em; color: var(--text); }
          .ProseMirror h3 { font-size: 1.15em; font-weight: 600; margin: 0.75em 0 0.5em; color: var(--text); }
          .ProseMirror p { margin: 0.5em 0; }
          .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; }
          .ProseMirror li { margin: 0.25em 0; }
          .ProseMirror blockquote {
            border-left: 3px solid var(--rose);
            padding: 12px 16px;
            margin: 0.75em 0;
            color: var(--text-mid);
            background: linear-gradient(135deg, rgba(192,139,136,0.06), transparent);
            border-radius: 0 10px 10px 0;
          }
          .ProseMirror hr {
            border: none;
            border-top: 1px solid var(--border);
            margin: 1.5em 0;
          }
          .ProseMirror code {
            background: var(--bg-input);
            border-radius: 4px;
            padding: 2px 6px;
            font-family: monospace;
            font-size: 0.9em;
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
