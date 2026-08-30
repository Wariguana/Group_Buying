import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import {
  ImageUploadError,
  uploadGroupBuyImage,
} from "@/app/lib/supabase-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "請先登入。" }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "圖片資料格式錯誤。" }, { status: 400 });
  }

  const image = formData.get("image");

  if (!(image instanceof File)) {
    return NextResponse.json({ message: "請選擇圖片檔案。" }, { status: 400 });
  }

  try {
    const { imageUrl } = await uploadGroupBuyImage({
      file: image,
      userId: user.id,
    });

    return NextResponse.json({ imageUrl }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof ImageUploadError
        ? error.message
        : "圖片上傳失敗，請稍後再試。";

    return NextResponse.json({ message }, { status: 400 });
  }
}
