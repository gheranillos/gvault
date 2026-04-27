import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/no-access(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const { userId } = await auth();
  if (!userId) {
    await auth.protect();
    return NextResponse.next();
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.emailAddresses.find(
    (entry) => entry.id === user.primaryEmailAddressId,
  )?.emailAddress;
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (email && adminEmails.includes(email.toLowerCase())) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!email || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL("/no-access", req.url));
  }

  const query = new URL(`${supabaseUrl}/rest/v1/allowed_users`);
  query.searchParams.set("select", "id");
  query.searchParams.set("email", `eq.${email.toLowerCase()}`);
  query.searchParams.set("subscription_active", "is.true");
  query.searchParams.set("limit", "1");

  const res = await fetch(query.toString(), {
    method: "GET",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.redirect(new URL("/no-access", req.url));
  }

  const rows = (await res.json()) as { id: number }[];
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.redirect(new URL("/no-access", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
