"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Image from "@tiptap/extension-image"
import CodeBlock from "@tiptap/extension-code-block"
import Placeholder from "@tiptap/extension-placeholder"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import { Table } from "@tiptap/extension-table"
import TableRow from "@tiptap/extension-table-row"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import Highlight from "@tiptap/extension-highlight"
import Underline from "@tiptap/extension-underline"
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
        padding: "5px 8px",
        borderRadius: 5,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        border: "none",
        background: active ? "rgba(192,139,136,0.15)" : "transparent",
        color: active ? "#C08B88" : "var(--text-secondary)",
        fontFamily: "'DM Sans', sans-serif",
        transition: "all 0.15s ease",
        lineHeight: 1,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--surface-elevated)"
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
        background: "rgba(255,255,255,0.06)",
        margin: "0 3px",
      }}
    />
  )
}

export const WIKI_EXTENSIONS = [
  StarterKit.configure({
    codeBlock: false,
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      style: "color: #C08B88; text-decoration: underline;",
    },
  }),
  Image.configure({
    HTMLAttributes: {
      style: "max-width: 100%; border-radius: 10px; margin: 8px 0; border: 1px solid rgba(255,255,255,0.06);",
    },
  }),
  CodeBlock.configure({
    HTMLAttributes: {
      style:
        "background: #0F1118; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #F0F0F2; overflow-x: auto;",
    },
  }),
  Placeholder.configure({
    placeholder: "Start writing...",
  }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
  Highlight.configure({
    HTMLAttributes: {
      style: "background: rgba(192,139,136,0.2); border-radius: 2px; padding: 1px 3px;",
    },
  }),
  Underline,
]

export default function WikiEditor({
  content,
  onChange,
  placeholder = "Start writing...",
}: WikiEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { style: "color: #C08B88; text-decoration: underline;" },
      }),
      Image.configure({
        HTMLAttributes: {
          style: "max-width: 100%; border-radius: 10px; margin: 8px 0; border: 1px solid rgba(255,255,255,0.06);",
        },
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          style: "background: #0F1118; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 16px; font-family: monospace; font-size: 13px; color: #F0F0F2; overflow-x: auto;",
        },
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Highlight.configure({
        HTMLAttributes: { style: "background: rgba(192,139,136,0.2); border-radius: 2px; padding: 1px 3px;" },
      }),
      Underline,
    ],
    content: content ?? undefined,
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getJSON())
    },
    editorProps: {
      attributes: {
        style:
          "min-height: 400px; outline: none; color: #F0F0F2; font-family: 'DM Sans', sans-serif; font-size: 14px; line-height: 1.8;",
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

  const addTable = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  if (!editor) return null

  return (
    <div style={{ background: "rgba(15,17,24,0.6)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.015)",
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
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline"
        >
          <span style={{ textDecoration: "underline" }}>U</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive("strike")}
          title="Strikethrough"
        >
          <span style={{ textDecoration: "line-through" }}>S</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive("highlight")}
          title="Highlight"
        >
          <span style={{ background: "rgba(192,139,136,0.3)", padding: "0 2px", borderRadius: 2 }}>H</span>
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
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive("taskList")}
          title="Task List"
        >
          {"\u2611"} Tasks
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
        <ToolbarButton onClick={addTable} title="Insert Table">
          {"\u2637"}
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
          title="Divider"
        >
          {"---"}
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div style={{ padding: "20px 24px" }}>
        <style>{`
          .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: rgba(240,240,242,0.2);
            pointer-events: none;
            height: 0;
          }
          .ProseMirror h1 { font-family: 'Bellfair', serif; font-size: 1.8em; font-weight: 400; margin: 0.8em 0 0.5em; color: #F0F0F2; }
          .ProseMirror h2 { font-family: 'Bellfair', serif; font-size: 1.4em; font-weight: 400; margin: 0.8em 0 0.5em; color: #F0F0F2; }
          .ProseMirror h3 { font-family: 'Bellfair', serif; font-size: 1.15em; font-weight: 400; margin: 0.8em 0 0.5em; color: #F0F0F2; }
          .ProseMirror p { margin: 0.5em 0; }
          .ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; }
          .ProseMirror li { margin: 0.25em 0; }
          .ProseMirror blockquote {
            border-left: 3px solid #C08B88;
            padding: 12px 16px;
            margin: 0.75em 0;
            color: rgba(240,240,242,0.55);
            background: linear-gradient(135deg, rgba(192,139,136,0.06), transparent);
            border-radius: 0 10px 10px 0;
          }
          .ProseMirror hr {
            border: none;
            border-top: 1px solid rgba(255,255,255,0.06);
            margin: 1.5em 0;
          }
          .ProseMirror code {
            background: rgba(255,255,255,0.05);
            border-radius: 4px;
            padding: 2px 6px;
            font-family: monospace;
            font-size: 0.9em;
          }
          .ProseMirror ul[data-type="taskList"] {
            list-style: none;
            padding-left: 0;
          }
          .ProseMirror ul[data-type="taskList"] li {
            display: flex;
            align-items: flex-start;
            gap: 8px;
          }
          .ProseMirror ul[data-type="taskList"] li label {
            display: flex;
            align-items: center;
            margin-top: 3px;
          }
          .ProseMirror ul[data-type="taskList"] li label input[type="checkbox"] {
            appearance: none;
            width: 16px;
            height: 16px;
            border: 1.5px solid rgba(192,139,136,0.4);
            border-radius: 4px;
            background: transparent;
            cursor: pointer;
            position: relative;
          }
          .ProseMirror ul[data-type="taskList"] li label input[type="checkbox"]:checked {
            background: #C08B88;
            border-color: #C08B88;
          }
          .ProseMirror ul[data-type="taskList"] li label input[type="checkbox"]:checked::after {
            content: "\u2713";
            position: absolute;
            top: -1px;
            left: 2px;
            font-size: 11px;
            color: #060709;
            font-weight: bold;
          }
          .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div > p {
            text-decoration: line-through;
            color: rgba(240,240,242,0.3);
          }
          .ProseMirror table {
            border-collapse: collapse;
            width: 100%;
            margin: 0.75em 0;
          }
          .ProseMirror th, .ProseMirror td {
            border: 1px solid rgba(255,255,255,0.06);
            padding: 8px 12px;
            text-align: left;
            font-size: 13px;
          }
          .ProseMirror th {
            background: rgba(255,255,255,0.03);
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: rgba(240,240,242,0.55);
          }
          .ProseMirror td {
            color: #F0F0F2;
          }
          .ProseMirror img {
            max-width: 100%;
            border-radius: 10px;
            margin: 8px 0;
          }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
