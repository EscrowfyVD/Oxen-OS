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
      className="px-2 py-1.5 rounded text-sm cursor-pointer border-none"
      style={{
        background: active ? "var(--rose-dim)" : "transparent",
        color: active ? "var(--rose)" : "var(--text-mid)",
        fontFamily: "'DM Sans', sans-serif",
        transition: "all 0.15s ease",
      }}
    >
      {children}
    </button>
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
          style: "max-width: 100%; border-radius: 8px; margin: 8px 0;",
        },
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          style:
            "background: var(--bg-input); border: 1px solid var(--border); border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; color: var(--text); overflow-x: auto;",
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
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-card)",
      }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 px-3 py-2 flex-wrap"
        style={{
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

        <div
          className="mx-1"
          style={{
            width: 1,
            height: 20,
            background: "var(--border)",
          }}
        />

        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          active={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          H3
        </ToolbarButton>

        <div
          className="mx-1"
          style={{
            width: 1,
            height: 20,
            background: "var(--border)",
          }}
        />

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

        <div
          className="mx-1"
          style={{
            width: 1,
            height: 20,
            background: "var(--border)",
          }}
        />

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

        <div
          className="mx-1"
          style={{
            width: 1,
            height: 20,
            background: "var(--border)",
          }}
        />

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
      <div className="p-4">
        <style>{`
          .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: var(--text-dim);
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
            padding-left: 1em;
            margin: 0.75em 0;
            color: var(--text-mid);
          }
          .ProseMirror hr {
            border: none;
            border-top: 1px solid var(--border);
            margin: 1em 0;
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
