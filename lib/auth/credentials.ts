// The strings passed to zod here are message keys in the `auth` namespace, not
// copy. `useAuthMessage` renders them; a schema cannot reach a translator.

import { z } from 'zod';

export const minPasswordLength = 12;
export const maxPasswordLength = 128;

const email = z
  .string()
  .trim()
  .min(1, 'enterEmail')
  .pipe(z.email('notAnEmailAddress'))
  .transform((value) => value.toLowerCase());

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'enterPassword'),
});

const chosenPassword = {
  password: z
    .string()
    .min(minPasswordLength, 'passwordTooShort')
    .max(maxPasswordLength, 'passwordTooLong'),
  confirmPassword: z.string().min(1, 'repeatYourPassword'),
};

const bothTheSame = ({
  password,
  confirmPassword,
}: {
  password: string;
  confirmPassword: string;
}) => password === confirmPassword;

const mismatch = {
  message: 'passwordsDoNotMatch',
  path: ['confirmPassword'],
};

export const signUpSchema = z
  .object({ email, ...chosenPassword })
  .refine(bothTheSame, mismatch);

export const resetRequestSchema = z.object({ email });

export const newPasswordSchema = z
  .object(chosenPassword)
  .refine(bothTheSame, mismatch);

export type SignInCredentials = z.infer<typeof signInSchema>;
export type SignUpCredentials = z.infer<typeof signUpSchema>;
export type ResetRequest = z.infer<typeof resetRequestSchema>;
export type NewPassword = z.infer<typeof newPasswordSchema>;

export const displayNameFor = (email: string) =>
  email.slice(0, email.indexOf('@'));
