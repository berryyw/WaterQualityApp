import { randomInt } from 'crypto';
import { compare, hash } from 'bcryptjs';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function generateVerificationCode() {
  return randomInt(100000, 1000000).toString();
}

export async function hashSecret(value: string) {
  return hash(value, 10);
}

export async function compareSecret(value: string, hashedValue: string) {
  return compare(value, hashedValue);
}

export function deriveNicknameFromEmail(email: string) {
  return normalizeEmail(email).split('@')[0] || '泳者';
}
