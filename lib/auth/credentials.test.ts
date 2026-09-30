import { describe, expect, it } from 'vitest';
import { wordsFor } from '../i18n/translator.ts';
import {
  displayNameFor,
  maxPasswordLength,
  minPasswordLength,
  signInSchema,
  signUpSchema,
} from './credentials.ts';

const password = 'elephants-over-the-alps';

const signUp = (values: Record<string, string>) =>
  signUpSchema.safeParse({
    email: 'hannibal@example.test',
    password,
    confirmPassword: password,
    ...values,
  });

const en = wordsFor('en', 'auth');

// The schemas carry message keys, so the test reads what a player would.
const render = (key: string | undefined) =>
  key === undefined
    ? undefined
    : en(key, { min: minPasswordLength, max: maxPasswordLength });

const messageFor = (
  result: ReturnType<typeof signUp>,
  field: 'email' | 'password' | 'confirmPassword',
) =>
  render(
    result.error?.issues.find((issue) => issue.path[0] === field)?.message,
  );

describe('signUpSchema', () => {
  it('trims and lowercases the address', () => {
    expect(signUp({ email: '  Hannibal@Example.Test ' }).data?.email).toBe(
      'hannibal@example.test',
    );
  });

  it('asks for an address before it complains about its shape', () => {
    expect(messageFor(signUp({ email: '   ' }), 'email')).toBe(
      'Enter your email address.',
    );
  });

  it('rejects something that is not an address', () => {
    expect(messageFor(signUp({ email: 'hannibal' }), 'email')).toMatch(
      /email address/,
    );
    expect(messageFor(signUp({ email: 'hannibal@' }), 'email')).toMatch(
      /email address/,
    );
    expect(messageFor(signUp({ email: 'hannibal@example' }), 'email')).toMatch(
      /email address/,
    );
  });

  it('holds the password to the same length Better Auth is configured with', () => {
    const short = 'a'.repeat(minPasswordLength - 1);
    const long = 'a'.repeat(maxPasswordLength + 1);

    expect(
      messageFor(
        signUp({ password: short, confirmPassword: short }),
        'password',
      ),
    ).toMatch(new RegExp(`${minPasswordLength} characters`));
    expect(
      messageFor(signUp({ password: long, confirmPassword: long }), 'password'),
    ).toMatch(new RegExp(`${maxPasswordLength} characters`));
  });

  it('refuses a repeat that does not match, and says so under the repeat', () => {
    const result = signUp({ confirmPassword: 'elephants-over-the-alp' });

    expect(messageFor(result, 'confirmPassword')).toBe(
      'Those two passwords do not match.',
    );
    expect(messageFor(result, 'password')).toBeUndefined();
  });

  it('asks for the repeat when it is empty', () => {
    expect(messageFor(signUp({ confirmPassword: '' }), 'confirmPassword')).toBe(
      'Repeat your password.',
    );
  });

  it('accepts a matching pair', () => {
    expect(signUp({}).success).toBe(true);
  });
});

describe('signInSchema', () => {
  it('asks only that the password is there — an old one may be anything', () => {
    expect(
      signInSchema.safeParse({ email: 'hannibal@example.test', password: 'x' })
        .success,
    ).toBe(true);
  });

  it('refuses an empty password', () => {
    const result = signInSchema.safeParse({
      email: 'hannibal@example.test',
      password: '',
    });

    expect(render(result.error?.issues[0]?.message)).toBe(
      'Enter your password.',
    );
  });
});

describe('displayNameFor', () => {
  it('names an account after the local part of its address', () => {
    expect(displayNameFor('hannibal@example.test')).toBe('hannibal');
  });
});
