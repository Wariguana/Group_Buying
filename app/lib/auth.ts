import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { prisma } from "@/app/lib/prisma";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/app/lib/session";

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    select: {
      id: true,
      username: true,
      role: true,
      storeId: true,
      enabled: true,
    },
  });

  if (
    !user ||
    !user.enabled ||
    user.role !== session.role ||
    user.storeId !== session.storeId
  ) {
    return null;
  }

  return user;
});