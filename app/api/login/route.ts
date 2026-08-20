import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const { account, password } = await request.json();

    //之後會改成資料庫驗證
    if (account === "admin" && password === "123") {
        return NextResponse.json({
            success: true,
            message: "登入成功",
        });
    }

    return NextResponse.json(
        {
            success: false,
            message: "帳號或密碼錯誤",
        },
        { status: 401 }
    );
}