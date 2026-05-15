import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid/client";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
  try {
    const { public_token } = await request.json();

    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Upsert the default user with Plaid credentials
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.id, "default-user"),
    });

    if (existingUser) {
      await db
        .update(schema.users)
        .set({
          plaidAccessToken: accessToken,
          plaidItemId: itemId,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, "default-user"));
    } else {
      await db.insert(schema.users).values({
        id: nanoid(),
        email: process.env.USER_EMAIL || "",
        plaidAccessToken: accessToken,
        plaidItemId: itemId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to exchange token:", error);
    return NextResponse.json(
      { error: "Failed to exchange token" },
      { status: 500 }
    );
  }
}
