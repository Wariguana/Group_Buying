import "server-only";

import { cookies } from "next/headers";

import { prisma } from "@/app/lib/prisma";
import {
  CUSTOMER_SESSION_COOKIE_NAME,
  verifyCustomerSessionToken,
} from "@/app/lib/session";

export async function getCurrentCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE_NAME)?.value;
  const session = await verifyCustomerSessionToken(token);

  if (!session) {
    return null;
  }

  return prisma.customer.findUnique({
    where: { id: session.customerId },
    select: {
      id: true,
      displayName: true,
      phone: true,
    },
  });
}
