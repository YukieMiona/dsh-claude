// @vitest-environment jsdom
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClaudePromptSuggestion, suggestionRemainder } from '../src/client/ClaudePromptSuggestion.tsx'
import { EMPTY_CLAUDE_PROJECTION, type ClaudeClientProjection } from '../src/client/projection.ts'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let mounted: Root | undefined

afterEach(() => {
  const root = mounted
  mounted = undefined
  if (root !== undefined) act(() => { root.unmount() })
  document.body.replaceChildren()
})

/** The Host composer's shape: the editor and its placeholder share a wrapper,
 *  and the input row with the slot sits elsewhere in the same card. */
function composer(text: string): { input: HTMLElement; wrapper: HTMLElement; slot: HTMLElement } {
  const card = document.createElement('div')
  card.setAttribute('data-composer-card', '')
  const wrapper = document.createElement('div')
  const input = document.createElement('div')
  input.setAttribute('data-composer-input', '')
  input.contentEditable = 'true'
  const paragraph = document.createElement('p')
  paragraph.textContent = text
  input.append(paragraph)
  wrapper.append(input)
  const slot = document.createElement('div')
  card.append(wrapper, slot)
  document.body.append(card)
  return { input, wrapper, slot }
}

function mount(slot: HTMLElement, draft: string, suggestion: string | undefined, acceptDraft: (text: string) => void): void {
  const snapshot: ClaudeClientProjection = { ...EMPTY_CLAUDE_PROJECTION, owned: true, ...(suggestion === undefined ? {} : { promptSuggestion: suggestion }) }
  mounted = createRoot(slot)
  act(() => {
    mounted?.render(<ClaudePromptSuggestion
      useClaudeProjection={<S,>(selector: (value: ClaudeClientProjection) => S): S => selector(snapshot)}
      useInput={<S,>(selector: (value: { readonly draft: string }) => S): S => selector({ draft })}
      acceptDraft={acceptDraft}
    />)
  })
}

function press(target: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => { target.dispatchEvent(event) })
  return event
}

function caretAt(node: Node, offset: number): void {
  const range = document.createRange()
  range.setStart(node, offset)
  range.collapse(true)
  document.getSelection()?.removeAllRanges()
  document.getSelection()?.addRange(range)
}

describe('suggestionRemainder', () => {
  it('ghosts only what the draft has not typed yet, and gives way once it diverges', () => {
    expect(suggestionRemainder('run the tests', '')).toBe('run the tests')
    expect(suggestionRemainder('run the tests', 'run ')).toBe('the tests')
    expect(suggestionRemainder('run the tests', 'run it')).toBeUndefined()
    expect(suggestionRemainder('run the tests', 'run the tests')).toBeUndefined()
    expect(suggestionRemainder(undefined, '')).toBeUndefined()
    // The command menu owns Tab while a `/` draft is open.
    expect(suggestionRemainder('/commit now', '/co')).toBeUndefined()
  })
})

describe('ClaudePromptSuggestion', () => {
  it('ghosts the remainder after the draft and takes it on Tab', () => {
    const { input, wrapper, slot } = composer('run ')
    const accept = vi.fn()
    mount(slot, 'run ', 'run the tests', accept)

    expect(wrapper.getAttribute('data-dsh-claude-suggestion')).toBe('inline')
    expect(wrapper.style.getPropertyValue('--dsh-claude-suggestion')).toBe('"the tests"')
    const event = press(input, 'Tab')
    expect(event.defaultPrevented).toBe(true)
    expect(accept).toHaveBeenCalledWith('run the tests')
  })

  it('takes it on → only with the caret at the end', () => {
    const { input, slot } = composer('run ')
    const accept = vi.fn()
    mount(slot, 'run ', 'run the tests', accept)
    const text = input.querySelector('p')!.firstChild!

    caretAt(text, 1)
    expect(press(input, 'ArrowRight').defaultPrevented).toBe(false)
    expect(accept).not.toHaveBeenCalled()
    caretAt(text, 4)
    expect(press(input, 'ArrowRight').defaultPrevented).toBe(true)
    expect(accept).toHaveBeenCalledWith('run the tests')
  })

  it('puts an empty draft in the placeholder seat and cleans up when the guess goes', () => {
    const { input, wrapper, slot } = composer('')
    const accept = vi.fn()
    mount(slot, '', 'run the tests', accept)
    expect(wrapper.getAttribute('data-dsh-claude-suggestion')).toBe('empty')

    act(() => { mounted?.unmount() })
    mounted = undefined
    expect(wrapper.hasAttribute('data-dsh-claude-suggestion')).toBe(false)
    expect(press(input, 'Tab').defaultPrevented).toBe(false)
  })

  it('offers a button that takes the suggestion, for a screen with no Tab key', () => {
    const { slot } = composer('')
    const accept = vi.fn()
    mount(slot, '', 'run the tests', accept)
    const button = slot.querySelector<HTMLButtonElement>('[data-dsh-claude-suggestion-accept]')
    expect(button).not.toBeNull()
    expect(button?.getAttribute('title')).toBe('run the tests')
    // The tap must not blur the editor before it lands.
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    act(() => { button?.dispatchEvent(down) })
    expect(down.defaultPrevented).toBe(true)
    act(() => { button?.click() })
    expect(accept).toHaveBeenCalledExactlyOnceWith('run the tests')
  })

  it('draws no button without a suggestion, or once the draft has diverged from it', () => {
    const first = composer('')
    mount(first.slot, '', undefined, vi.fn())
    expect(first.slot.querySelector('[data-dsh-claude-suggestion-accept]')).toBeNull()
    act(() => { mounted?.unmount() })
    mounted = undefined
    const second = composer('something else')
    mount(second.slot, 'something else', 'run the tests', vi.fn())
    expect(second.slot.querySelector('[data-dsh-claude-suggestion-accept]')).toBeNull()
  })

  it('leaves keys alone while an IME is composing', () => {
    const { input, slot } = composer('run ')
    const accept = vi.fn()
    mount(slot, 'run ', 'run the tests', accept)
    input.setAttribute('data-composer-composing', '')
    expect(press(input, 'Tab').defaultPrevented).toBe(false)
    expect(accept).not.toHaveBeenCalled()
  })
})
