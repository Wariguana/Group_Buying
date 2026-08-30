import "server-only";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

type ImageFileType = {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
};

type StorageConfig = {
  bucket: string;
  serviceRoleKey: string;
  url: string;
};

export class ImageUploadError extends Error {}

function getStorageConfig(): StorageConfig {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "group-buy-images";

  if (!url || !serviceRoleKey) {
    throw new ImageUploadError(
      "圖片上傳尚未設定。請設定 Supabase Storage 環境變數。",
    );
  }

  return { bucket, serviceRoleKey, url };
}

function getImageFileType(bytes: Uint8Array): ImageFileType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

function encodeObjectPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function uploadGroupBuyImage({
  file,
  userId,
}: {
  file: File;
  userId: string;
}) {
  if (file.size === 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new ImageUploadError("圖片檔案大小須介於 1 byte 至 5MB。");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const imageFileType = getImageFileType(bytes);

  if (!imageFileType) {
    throw new ImageUploadError("請上傳 JPG、PNG 或 WebP 圖片。");
  }

  const { bucket, serviceRoleKey, url } = getStorageConfig();
  const objectPath = `group-buys/${userId}/${crypto.randomUUID()}.${imageFileType.extension}`;
  const uploadResponse = await fetch(
    `${url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": imageFileType.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "x-upsert": "false",
      },
      body: bytes,
    },
  );

  if (!uploadResponse.ok) {
    throw new ImageUploadError("圖片上傳失敗，請稍後再試。");
  }

  return {
    imageUrl: `${url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`,
  };
}
