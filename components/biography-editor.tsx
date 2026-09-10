'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  ImagePlus,
  Undo2,
  Redo2,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { apiPath } from '@/lib/instances';
import { BIOGRAPHY_MAX_LENGTH, biographyEditorHtml } from '@/lib/biography';
import type { Official } from '@/lib/model';

export function BiographyEditor({
  official,
  agencyId,
  disabled,
  onChange,
  onUploading,
}: {
  official: Official;
  agencyId: string;
  disabled: boolean;
  onChange: (html: string) => void;
  onUploading: (busy: boolean) => void;
}) {
  const [sourceMode, setSourceMode] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const imageExtension = useMemo(
    () =>
      Image.extend({
        parseHTML() {
          return [
            {
              tag: 'img[src]',
              getAttrs: (node) => {
                const src = (node as HTMLElement).getAttribute('src') || '';
                return src.startsWith(apiPath(agencyId) + '/photos/') ||
                  src.startsWith('/portraits/' + agencyId + '/')
                  ? null
                  : false;
              },
            },
          ];
        },
      }).configure({ allowBase64: false }),
    [agencyId],
  );
  const html = biographyEditorHtml(official);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        link: {
          openOnClick: false,
          defaultProtocol: 'https',
          protocols: ['https', 'mailto', 'tel'],
        },
      }),
      imageExtension,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    content: html,
    editable: !disabled,
    editorProps: {
      attributes: {
        'aria-label': 'Biography text',
        role: 'textbox',
        'aria-multiline': 'true',
        class: 'biography-content biography-writing',
      },
    },
    onUpdate: ({ editor }) => {
      setError('');
      onChange(editor.isEmpty ? '' : editor.getHTML());
    },
  });
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);
  useEffect(() => {
    if (editor && !sourceMode && html !== editor.getHTML())
      editor.commands.setContent(html, { emitUpdate: false });
  }, [editor, html, sourceMode]);

  async function upload(file: File) {
    if (!editor || disabled) return;
    if (!imageAlt.trim()) {
      setError('Add an image description before choosing a picture.');
      return;
    }
    setImageBusy(true);
    onUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('photo', file);
      const r = await fetch(apiPath(agencyId) + '/photos', {
        method: 'POST',
        body: form,
      });
      const result = await r.json();
      if (!r.ok)
        throw Error(result.error || 'The image could not be uploaded.');
      editor
        .chain()
        .focus()
        .setImage({ src: result.url, alt: imageAlt.trim() })
        .run();
      setImageAlt('');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setImageBusy(false);
      onUploading(false);
    }
  }
  const inactive = disabled || !editor || sourceMode || imageBusy;
  const tools = [
    {
      label: 'Bold',
      icon: Bold,
      active: editor?.isActive('bold'),
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: 'Italic',
      icon: Italic,
      active: editor?.isActive('italic'),
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: 'Underline',
      icon: Underline,
      active: editor?.isActive('underline'),
      run: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      label: 'Bulleted list',
      icon: List,
      active: editor?.isActive('bulletList'),
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: 'Numbered list',
      icon: ListOrdered,
      active: editor?.isActive('orderedList'),
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Quote',
      icon: Quote,
      active: editor?.isActive('blockquote'),
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Align left',
      icon: AlignLeft,
      active: editor?.isActive({ textAlign: 'left' }),
      run: () => editor?.chain().focus().setTextAlign('left').run(),
    },
    {
      label: 'Align center',
      icon: AlignCenter,
      active: editor?.isActive({ textAlign: 'center' }),
      run: () => editor?.chain().focus().setTextAlign('center').run(),
    },
    {
      label: 'Align right',
      icon: AlignRight,
      active: editor?.isActive({ textAlign: 'right' }),
      run: () => editor?.chain().focus().setTextAlign('right').run(),
    },
  ];
  return (
    <div className="biography-editor">
      <div
        className="biography-editor-modes"
        role="group"
        aria-label="Biography editor mode"
      >
        <button
          type="button"
          disabled={disabled || !editor}
          aria-pressed={!sourceMode}
          onClick={() => {
            if (editor && sourceMode) {
              editor.commands.setContent(html, { emitUpdate: false });
              onChange(editor.isEmpty ? '' : editor.getHTML());
            }
            setSourceMode(false);
          }}
        >
          Visual editor
        </button>
        <button
          type="button"
          disabled={disabled || !editor}
          aria-pressed={sourceMode}
          onClick={() => setSourceMode(true)}
        >
          HTML
        </button>
      </div>
      <div
        className="biography-toolbar"
        role="group"
        aria-label="Biography formatting"
      >
        <select
          aria-label="Text style"
          disabled={inactive}
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
        {tools.map((tool) => (
          <button
            type="button"
            key={tool.label}
            title={tool.label}
            aria-label={tool.label}
            aria-pressed={!!tool.active}
            disabled={inactive}
            onMouseDown={(e) => e.preventDefault()}
            onClick={tool.run}
          >
            <tool.icon size={17} />
          </button>
        ))}
        <button
          type="button"
          aria-label="Add or edit link"
          title="Add or edit link"
          disabled={inactive}
          onClick={() => {
            setLinkUrl(editor?.getAttributes('link').href || '');
            setShowLink(!showLink);
          }}
        >
          <LinkIcon size={17} />
        </button>
        <button
          type="button"
          aria-label="Remove link"
          title="Remove link"
          disabled={inactive || !editor?.isActive('link')}
          onClick={() => editor?.chain().focus().unsetLink().run()}
        >
          <Unlink size={17} />
        </button>
        <button
          type="button"
          aria-label="Undo"
          title="Undo"
          disabled={inactive || !editor?.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 size={17} />
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo"
          disabled={inactive || !editor?.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 size={17} />
        </button>
      </div>
      {showLink && !sourceMode && (
        <div className="biography-editor-link">
          <label className="field">
            Link address
            <input
              type="text"
              value={linkUrl}
              placeholder="https://"
              disabled={disabled}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn"
            disabled={disabled}
            onClick={() => {
              const url = linkUrl.trim();
              if (!/^(https:\/\/|mailto:|tel:)/i.test(url)) {
                setError('Use an https://, mailto:, or tel: link.');
                return;
              }
              editor
                ?.chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: url })
                .run();
              setShowLink(false);
              setError('');
            }}
          >
            Apply link
          </button>
        </div>
      )}
      {sourceMode ? (
        <textarea
          className="biography-source"
          aria-label="Biography HTML"
          value={html}
          maxLength={BIOGRAPHY_MAX_LENGTH}
          disabled={disabled}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
      {!editor && <p className="small muted">Loading biography editor…</p>}
      <div className="biography-image-tools">
        <label className="field">
          Image description
          <input
            value={imageAlt}
            disabled={inactive}
            placeholder="Describe the picture for readers"
            onChange={(e) => setImageAlt(e.target.value)}
            maxLength={300}
          />
        </label>
        <button
          type="button"
          className="btn"
          disabled={inactive || !imageAlt.trim()}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus size={16} />
          {imageBusy ? 'Uploading…' : 'Add picture'}
        </button>
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          aria-label="Upload biography picture"
          accept="image/jpeg,image/png,image/gif"
          disabled={inactive}
          onChange={(e) => {
            if (e.target.files?.[0]) void upload(e.target.files[0]);
            e.target.value = '';
          }}
        />
      </div>
      <p className="small muted">
        JPG, PNG or GIF, up to 5 MB. Select an image and press Delete to remove
        it.
      </p>
      {html.length > BIOGRAPHY_MAX_LENGTH && (
        <p className="notice error" role="alert">
          This biography is too long. Shorten it before saving.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
