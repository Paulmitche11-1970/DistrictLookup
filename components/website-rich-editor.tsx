'use client';
import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { safeWebsiteLink } from '@/lib/website-model';
import type { WebsiteMedia } from '@/lib/website-model';
import styles from './website-admin.module.css';

export default function WebsiteRichEditor({
  value,
  onChange,
  disabled,
  chooseMedia,
  label = 'Content',
}: {
  value: string;
  onChange: (html: string) => void;
  disabled: boolean;
  chooseMedia: (choose: (m: WebsiteMedia) => void) => void;
  label?: string;
}) {
  const [source, setSource] = useState(false),
    [link, setLink] = useState<string | null>(null),
    [error, setError] = useState('');
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          defaultProtocol: 'https',
          protocols: ['https', 'mailto', 'tel'],
        },
      }),
      Image.configure({ allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': label,
        'aria-multiline': 'true',
        class: styles.writing,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? '' : editor.getHTML()),
  });
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  useEffect(() => {
    if (editor && !source && value !== editor.getHTML())
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, source, value]);
  const off = disabled || !editor || source;
  const commands = [
    {
      label: 'Bold',
      active: 'bold',
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      active: 'italic',
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Underline',
      active: 'underline',
      run: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      label: 'Bullets',
      active: 'bulletList',
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered list',
      active: 'orderedList',
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Quote',
      active: 'blockquote',
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
  ];
  return (
    <div className={styles.richEditor}>
      <div
        className={styles.toolbar}
        role="group"
        aria-label={label + ' formatting'}
      >
        <select
          aria-label="Text style"
          disabled={off}
          value={
            editor?.isActive('heading', { level: 2 })
              ? '2'
              : editor?.isActive('heading', { level: 3 })
                ? '3'
                : 'p'
          }
          onChange={(e) =>
            e.target.value === 'p'
              ? editor?.chain().focus().setParagraph().run()
              : editor
                  ?.chain()
                  .focus()
                  .setHeading({ level: Number(e.target.value) as 2 | 3 })
                  .run()
          }
        >
          <option value="p">Paragraph</option>
          <option value="2">Heading</option>
          <option value="3">Subheading</option>
        </select>
        {commands.map((c) => (
          <button
            type="button"
            key={c.label}
            disabled={off}
            aria-pressed={!!editor?.isActive(c.active)}
            onClick={c.run}
          >
            {c.label}
          </button>
        ))}
        <button
          type="button"
          disabled={off}
          onClick={() => setLink(editor?.getAttributes('link').href || '')}
        >
          Link
        </button>
        <button
          type="button"
          disabled={off || !editor?.isActive('link')}
          onClick={() => editor?.chain().focus().unsetLink().run()}
        >
          Unlink
        </button>
        <button
          type="button"
          disabled={off}
          onClick={() =>
            chooseMedia((m) =>
              editor
                ?.chain()
                .focus()
                .setImage({ src: m.url, alt: m.alt })
                .run(),
            )
          }
        >
          Image
        </button>
        <select
          aria-label="Text alignment"
          disabled={off}
          value={
            editor?.isActive({ textAlign: 'center' })
              ? 'center'
              : editor?.isActive({ textAlign: 'right' })
                ? 'right'
                : 'left'
          }
          onChange={(e) =>
            editor?.chain().focus().setTextAlign(e.target.value).run()
          }
        >
          <option value="left">Align left</option>
          <option value="center">Center</option>
          <option value="right">Align right</option>
        </select>
        <button
          type="button"
          disabled={off || !editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          Undo
        </button>
        <button
          type="button"
          disabled={off || !editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          Redo
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={source}
          onClick={() => setSource(!source)}
        >
          {source ? 'Visual editor' : 'HTML'}
        </button>
      </div>
      {link !== null && (
        <div className={styles.linkEditor}>
          <label>
            Link URL
            <input
              aria-label="Link URL"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (!link || !safeWebsiteLink(link)) {
                setError('Use https://, a page path, mailto:, or tel:.');
                return;
              }
              editor
                ?.chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: link })
                .run();
              setLink(null);
              setError('');
            }}
          >
            Apply link
          </button>
          <button type="button" onClick={() => setLink(null)}>
            Cancel
          </button>
        </div>
      )}
      {source ? (
        <textarea
          aria-label={label + ' HTML'}
          className={styles.source}
          value={value}
          maxLength={100000}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
      <p className={styles.hint}>
        Format text, add links, or insert a library image. HTML supports text
        formatting; scripts and embeds are removed.
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
