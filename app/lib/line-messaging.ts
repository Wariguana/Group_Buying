import "server-only";

type GroupBuyCardInput = {
  groupBuyStoreId: string;
  lineGroupId: string;
  title: string;
  content: string | null;
  productName: string;
  unit: string | null;
  groupPrice: { toString(): string };
  endAt: Date;
  pickupStart: Date;
  pickupEnd: Date;
};

function shorten(text: string, maximumLength: number) {
  return text.length > maximumLength
    ? `${text.slice(0, maximumLength - 1)}…`
    : text;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(date);
}

function getOrderUrl(groupBuyStoreId: string) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

  if (!liffId) {
    throw new Error("缺少 NEXT_PUBLIC_LIFF_ID 環境變數。");
  }

  return `https://liff.line.me/${liffId}/buy/${groupBuyStoreId}`;
}

export async function sendGroupBuyCard(input: GroupBuyCardInput) {
  const accessToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("缺少 LINE_MESSAGING_CHANNEL_ACCESS_TOKEN 環境變數。");
  }

  const title = shorten(input.title, 100);
  const description = input.content ? shorten(input.content, 150) : null;
  const priceLabel = `NT$ ${input.groupPrice.toString()}${
    input.unit ? `／${shorten(input.unit, 20)}` : ""
  }`;

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.lineGroupId,
      messages: [
        {
          type: "flex",
          altText: shorten(`新團購：${input.title}`, 400),
          contents: {
            type: "bubble",
            body: {
              type: "box",
              layout: "vertical",
              spacing: "md",
              contents: [
                {
                  type: "text",
                  text: "新團購已發布",
                  size: "sm",
                  color: "#007F83",
                  weight: "bold",
                },
                {
                  type: "text",
                  text: title,
                  size: "xl",
                  weight: "bold",
                  wrap: true,
                },
                ...(description
                  ? [
                      {
                        type: "text",
                        text: description,
                        size: "sm",
                        color: "#666666",
                        wrap: true,
                      },
                    ]
                  : []),
                {
                  type: "separator",
                  margin: "md",
                },
                {
                  type: "box",
                  layout: "vertical",
                  spacing: "sm",
                  margin: "md",
                  contents: [
                    {
                      type: "text",
                      text: `商品：${shorten(input.productName, 100)}`,
                      size: "sm",
                      wrap: true,
                    },
                    {
                      type: "text",
                      text: `團購價：${priceLabel}`,
                      size: "sm",
                      weight: "bold",
                    },
                    {
                      type: "text",
                      text: `下單截止：${formatDateTime(input.endAt)}`,
                      size: "sm",
                      color: "#666666",
                      wrap: true,
                    },
                    {
                      type: "text",
                      text: `本店取貨：${formatDateTime(input.pickupStart)} ～ ${formatDateTime(input.pickupEnd)}`,
                      size: "sm",
                      color: "#666666",
                      wrap: true,
                    },
                  ],
                },
              ],
            },
            footer: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  color: "#007F83",
                  action: {
                    type: "uri",
                    label: "立即查看／下單",
                    uri: getOrderUrl(input.groupBuyStoreId),
                  },
                },
              ],
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`LINE 訊息發送失敗（HTTP ${response.status}）。`);
  }
}
