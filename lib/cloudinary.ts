/**
 * lib/cloudinary.ts
 * ─────────────────────────────────────────────────────
 * Cloudinary image upload utility for BRASSFLOW ERP.
 * Replaces Supabase Storage for all file uploads.
 * Credentials are read from NEXT_PUBLIC_ env variables.
 * ─────────────────────────────────────────────────────
 */

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

if (!CLOUD_NAME || !UPLOAD_PRESET) {
  // Only warn in development — silent in production
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '[Cloudinary] NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET is missing in .env'
    );
  }
}

export type CloudinaryUploadResult = {
  secure_url: string;
  public_id: string;
  original_filename: string;
};

/**
 * Upload a single File to Cloudinary.
 * Returns the secure URL string on success.
 */
export async function uploadToCloudinary(
  file: File,
  folder?: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  if (folder) formData.append('folder', folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Cloudinary upload failed: ${res.statusText}`);
  }

  const data: CloudinaryUploadResult = await res.json();
  return data.secure_url;
}

/**
 * Upload multiple files to Cloudinary concurrently.
 * Returns an array of secure URLs in the same order as input files.
 */
export async function uploadManyToCloudinary(
  files: File[],
  folder?: string
): Promise<string[]> {
  const results = await Promise.all(
    files.map((file) => uploadToCloudinary(file, folder))
  );
  return results;
}
