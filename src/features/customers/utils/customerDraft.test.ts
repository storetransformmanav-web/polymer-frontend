import { describe, expect, it } from 'vitest'
import {
  buildCustomerBody,
  buildPasswordBody,
  EMPTY_DRAFT,
  isDraftDirty,
  validateCustomerDraft,
  validatePasswordPair,
} from './customerDraft.ts'

const draft = { ...EMPTY_DRAFT, shop: 'polymer-uk', email: 'a@example.com' }

describe('the website password of a new customer', () => {
  it('is optional: nothing typed means no password call and no error', () => {
    expect(buildPasswordBody(draft)).toBeNull()
    expect(validateCustomerDraft(draft)).toEqual({})
  })

  it('needs both boxes once one is typed, and the two must match', () => {
    expect(validatePasswordPair('abc', '')).toEqual({
      passwordConfirmation: 'Enter the password again',
    })
    expect(validatePasswordPair('', 'abc')).toEqual({ password: 'Enter the password' })
    expect(validatePasswordPair('abc', 'abd')).toEqual({
      passwordConfirmation: 'The passwords do not match',
    })
    expect(validatePasswordPair('abc', 'abc')).toEqual({})
  })

  it('leaves every other rule to the backend (no length or strength check here)', () => {
    expect(validatePasswordPair('a', 'a')).toEqual({})
  })

  it('is sent exactly as typed, in its own body, never in POST /customers', () => {
    const typed = { ...draft, password: ' Pass 1 ', passwordConfirmation: ' Pass 1 ' }
    expect(buildPasswordBody(typed)).toEqual({
      password: ' Pass 1 ',
      password_confirmation: ' Pass 1 ',
    })
    expect(JSON.stringify(buildCustomerBody(typed))).not.toContain('Pass 1')
    expect(isDraftDirty({ ...EMPTY_DRAFT, password: 'x' })).toBe(true)
  })
})
