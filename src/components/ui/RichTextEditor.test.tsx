import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { RichTextEditor } from './RichTextEditor.tsx'

/** Holds the value like a form does, and reports every change. */
function Harness({
  initial = '<p>Hello world</p>',
  onChange,
}: {
  initial?: string
  onChange: (html: string) => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <RichTextEditor
      id="rte"
      label="Description"
      value={value}
      onChange={(html) => {
        setValue(html)
        onChange(html)
      }}
    />
  )
}

async function setup(initial?: string) {
  const onChange = vi.fn()
  const user = userEvent.setup()
  const view = render(<Harness initial={initial} onChange={onChange} />)
  const editable = await screen.findByRole('textbox', { name: 'Description' })
  const last = () => onChange.mock.calls.at(-1)?.[0] as string
  return { user, onChange, last, editable, ...view }
}

const tool = (name: string) => screen.getByRole('button', { name })

/** Opens a toolbar menu and picks an entry. */
async function pick(
  user: ReturnType<typeof userEvent.setup>,
  menu: string | RegExp,
  item: string,
) {
  await user.click(screen.getByRole('button', { name: menu }))
  await user.click(await screen.findByRole('menuitem', { name: item }))
}

describe('RichTextEditor', () => {
  it('shows the HTML as formatted content', async () => {
    const { editable } = await setup(
      '<h2>Sushi tray</h2><p>A <strong>strong</strong> tray</p><ul><li>One</li><li>Two</li></ul>',
    )

    expect(
      within(editable).getByRole('heading', { level: 2, name: 'Sushi tray' }),
    ).toBeInTheDocument()
    expect(within(editable).getByText('strong').tagName).toBe('STRONG')
    expect(within(editable).getAllByRole('listitem')).toHaveLength(2)
  })

  it('has the whole toolbar', async () => {
    await setup()

    for (const name of [
      'Paragraph',
      'Bold',
      'Italic',
      'Underline',
      'Text color',
      'Align',
      'Insert link',
      'Insert image',
      'Insert video',
      'Table',
      'Bulleted list',
      'Numbered list',
      'Decrease indent',
      'Increase indent',
      'Clear formatting',
      'Edit HTML',
    ]) {
      expect(tool(name)).toBeInTheDocument()
    }
  })

  it('does not call onChange just because it was opened', async () => {
    const { onChange } = await setup('<p>Untouched</p>')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('turns bold, italic and underline on and off', async () => {
    const { user } = await setup()

    for (const name of ['Bold', 'Italic', 'Underline']) {
      expect(tool(name)).toHaveAttribute('aria-pressed', 'false')
      await user.click(tool(name))
      expect(tool(name)).toHaveAttribute('aria-pressed', 'true')
      await user.click(tool(name))
      expect(tool(name)).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('changes the block style from the Paragraph menu', async () => {
    const { user, last } = await setup()
    await pick(user, 'Paragraph', 'Heading 2')

    expect(last()).toBe('<h2>Hello world</h2>')
    expect(screen.getByRole('button', { name: 'Heading 2' })).toBeInTheDocument()

    await pick(user, 'Heading 2', 'Paragraph')
    expect(last()).toBe('<p>Hello world</p>')
  })

  it('makes bulleted and numbered lists', async () => {
    const { user, last } = await setup()

    await user.click(tool('Bulleted list'))
    expect(last()).toContain('<ul>')
    expect(tool('Bulleted list')).toHaveAttribute('aria-pressed', 'true')

    await user.click(tool('Numbered list'))
    expect(last()).toContain('<ol>')
  })

  it('aligns the text', async () => {
    const { user, last } = await setup()
    await pick(user, 'Align', 'Align center')

    expect(last()).toContain('text-align: center')
  })

  it('colours the selected text, and goes back to the default colour', async () => {
    const { user, last, editable } = await setup()
    await user.click(editable)
    await user.keyboard('{Control>}a{/Control}')

    await user.click(tool('Text color'))
    await user.click(await screen.findByRole('button', { name: 'Text color Red' }))
    expect(last()).toContain('color: rgb(217, 48, 37)')

    await user.click(tool('Text color'))
    await user.click(await screen.findByRole('menuitem', { name: 'Default color' }))
    expect(last()).not.toContain('rgb(217')
  })

  it('clears the formatting of the selected text', async () => {
    const { user, last, editable } = await setup('<h2>Big <strong>bold</strong></h2>')
    await user.click(editable)
    await user.keyboard('{Control>}a{/Control}')
    await user.click(tool('Clear formatting'))

    expect(last()).toBe('<p>Big bold</p>')
  })

  describe('links', () => {
    async function openLink(user: ReturnType<typeof userEvent.setup>) {
      await user.click(tool('Insert link'))
      return screen.findByLabelText('Link address')
    }

    it('adds a link by its address', async () => {
      const { user, last } = await setup()
      await user.type(await openLink(user), 'https://example.com/page')
      await user.click(screen.getByRole('button', { name: 'Apply' }))

      expect(last()).toContain('href="https://example.com/page"')
      expect(last()).toContain('noopener')
    })

    it('accepts email and phone links', async () => {
      const { user, last } = await setup()
      await user.type(await openLink(user), 'mailto:sales@example.com')
      await user.click(screen.getByRole('button', { name: 'Apply' }))

      expect(last()).toContain('href="mailto:sales@example.com"')
    })

    it('refuses anything else — a script address above all', async () => {
      const { user, onChange } = await setup()
      await user.type(await openLink(user), 'javascript:alert(1)')
      await user.click(screen.getByRole('button', { name: 'Apply' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/https/)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('images', () => {
    async function openImage(user: ReturnType<typeof userEvent.setup>) {
      await user.click(tool('Insert image'))
      return screen.findByLabelText('Image address')
    }

    it('inserts an image by its https address', async () => {
      const { user, last } = await setup()
      await user.type(await openImage(user), 'https://cdn.example.com/a.jpg')
      await user.type(screen.getByLabelText('Alt text'), 'A tray')
      await user.click(screen.getByRole('button', { name: 'Add image' }))

      expect(last()).toContain('src="https://cdn.example.com/a.jpg"')
      expect(last()).toContain('alt="A tray"')
    })

    it('only takes https addresses', async () => {
      const { user, onChange } = await setup()
      await user.type(await openImage(user), 'http://insecure.example.com/a.jpg')
      await user.click(screen.getByRole('button', { name: 'Add image' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/https/)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('videos', () => {
    it('inserts a YouTube video as a privacy-friendly embed', async () => {
      const { user, last } = await setup()
      await user.click(tool('Insert video'))
      await user.type(
        await screen.findByLabelText('YouTube address'),
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      )
      await user.click(screen.getByRole('button', { name: 'Add video' }))

      expect(last()).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    })

    it('refuses addresses that are not YouTube', async () => {
      const { user, onChange } = await setup()
      await user.click(tool('Insert video'))
      await user.type(
        await screen.findByLabelText('YouTube address'),
        'https://evil.example.com/v.mp4',
      )
      await user.click(screen.getByRole('button', { name: 'Add video' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(/YouTube/)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('tables', () => {
    it('inserts a table, then offers row and column changes', async () => {
      const { user, last } = await setup()

      await user.click(tool('Table'))
      // Outside a table only "Insert table" is available.
      expect(await screen.findByRole('menuitem', { name: 'Delete table' })).toBeDisabled()
      await user.click(screen.getByRole('menuitem', { name: 'Insert table' }))
      expect(last()).toContain('<table')
      expect(last()).toContain('<th')

      await user.click(tool('Table'))
      expect(await screen.findByRole('menuitem', { name: 'Add row below' })).toBeEnabled()
      await user.click(screen.getByRole('menuitem', { name: 'Delete table' }))
      expect(last()).not.toContain('<table')
    })
  })

  describe('the HTML view', () => {
    it('shows the HTML, passes edits straight on, and shows them visually on the way back', async () => {
      const { user, last } = await setup('<p>Before</p>')
      await user.click(tool('Edit HTML'))

      const source = screen.getByLabelText('Description (HTML)')
      expect(source).toHaveValue('<p>Before</p>')
      await user.clear(source)
      await user.type(source, '<h3>Raw</h3>')
      expect(last()).toBe('<h3>Raw</h3>')

      await user.click(tool('Edit HTML'))
      expect(
        await within(screen.getByRole('textbox', { name: 'Description' })).findByRole(
          'heading',
          {
            level: 3,
            name: 'Raw',
          },
        ),
      ).toBeInTheDocument()
    })

    it('going back to the visual editor is not itself an edit', async () => {
      const { user, onChange } = await setup('<p>Same</p>')
      await user.click(tool('Edit HTML'))
      await user.click(tool('Edit HTML'))

      await screen.findByRole('textbox', { name: 'Description' })
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('safety', () => {
    it('drops scripts, event handlers and script links from the HTML it is given', async () => {
      const { editable } = await setup(
        '<script>window.hacked = true</script><p onclick="window.hacked = true">Hi <a href="javascript:alert(1)">link</a></p><img src="x" onerror="window.hacked = true">',
      )

      expect(editable.querySelector('script')).toBeNull()
      expect(editable.querySelector('[onclick]')).toBeNull()
      expect(editable.querySelector('[onerror]')).toBeNull()
      expect(editable.querySelector('a[href^="javascript"]')).toBeNull()
      expect((window as unknown as { hacked?: boolean }).hacked).toBeUndefined()
    })

    it('does not keep base64 images', async () => {
      const { editable } = await setup('<p><img src="data:image/png;base64,AAAA"></p>')
      await waitFor(() => expect(editable.querySelector('img[src^="data:"]')).toBeNull())
    })
  })
})
