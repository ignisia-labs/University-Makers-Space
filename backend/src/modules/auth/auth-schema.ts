import { z } from "zod";

const email = z.string().trim().email().toLowerCase();
const password = z.string().min(8).max(128);

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    email,
    password,
  }).strict(),
});

export const loginSchema = z.object({
  body: z.object({ email, password }).strict(),
});
