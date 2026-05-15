import { NextResponse } from "next/server";
import { fetchAndStoreHoldings } from "@/lib/plaid/holdings";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function POST() {
  try {
    const user = await db.query.users.findFirst();
    if (!user) {
      return NextResponse.json({ error: "No user found" }, { status: 404 });
    }

    const count = await fetchAndStoreHoldings(user.id);
    return NextResponse.json({ success: true, holdingsCount: count });
  } catch (error) {
    console.error("Failed to fetch holdings:", error);
    return NextResponse.json(
      { error: "Failed to fetch holdings" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await db.query.users.findFirst();
    if (!user) {
      return NextResponse.json({ error: "No user found" }, { status: 404 });
    }

    // Get the most recent snapshot
    const latestHolding = await db.query.holdings.findFirst({
      where: eq(schema.holdings.userId, user.id),
      orderBy: [desc(schema.holdings.createdAt)],
    });

    if (!latestHolding) {
      return NextResponse.json({ holdings: [] });
    }

    const holdings = await db.query.holdings.findMany({
      where: eq(schema.holdings.snapshotDate, latestHolding.snapshotDate),
    });

    return NextResponse.json({ holdings });
  } catch (error) {
    console.error("Failed to get holdings:", error);
    return NextResponse.json(
      { error: "Failed to get holdings" },
      { status: 500 }
    );
  }
}
