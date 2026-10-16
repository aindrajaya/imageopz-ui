// Upload limits shared by the dropzone, onDrop validation and the upload client.
// Must match the backend tiers (imageopz-server app/config.py, contracts/uploads-api.md).

const MB = 1024 * 1024;

export interface TierLimits {
  maxBytes: number;
  maxFiles: number;
}

export const FREE_LIMITS: TierLimits = { maxBytes: 10 * MB, maxFiles: 3 };
export const PRO_LIMITS: TierLimits = { maxBytes: 50 * MB, maxFiles: 30 };

export function tierLimits(isPro: boolean): TierLimits {
  return isPro ? PRO_LIMITS : FREE_LIMITS;
}

export function maxMegabytes(isPro: boolean): number {
  return tierLimits(isPro).maxBytes / MB;
}

// Content type -> allowed extensions (the backend checks both).
export const ACCEPTED_IMAGE_TYPES: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export const MAX_FILENAME_LENGTH = 255;

// True if the backend will accept this file's type, extension, name and size for the tier.
export function isAcceptedImage(file: { name: string; size: number; type: string }, isPro: boolean): boolean {
  const extensions = ACCEPTED_IMAGE_TYPES[file.type.toLowerCase()];
  if (!extensions) return false;
  const name = file.name.toLowerCase();
  if (!extensions.some((ext) => name.endsWith(ext))) return false;
  if (file.name.length < 1 || file.name.length > MAX_FILENAME_LENGTH) return false;
  return file.size > 0 && file.size <= tierLimits(isPro).maxBytes;
}
