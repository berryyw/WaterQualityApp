import { extname } from 'path';
import { randomUUID } from 'crypto';

function normalizeExtension(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  return extension || '.bin';
}

export function buildUserAvatarObjectKey(userId: string, fileName: string) {
  return `users/${userId}/avatar/${randomUUID()}${normalizeExtension(fileName)}`;
}

export function buildVenueCoverObjectKey(venueId: string, fileName: string) {
  return `venues/${venueId}/cover/${randomUUID()}${normalizeExtension(fileName)}`;
}
