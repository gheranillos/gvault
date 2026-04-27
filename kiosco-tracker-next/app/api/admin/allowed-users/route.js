import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const createSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return null;
  return createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
};

const isAuthorizedAdmin = async () => {
  const { userId } = await auth();
  if (!userId) return false;
  const user = await currentUser();
  const email = user?.emailAddresses.find(
    (entry) => entry.id === user.primaryEmailAddressId,
  )?.emailAddress;
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
};

export async function GET() {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("allowed_users")
    .select("id,email,subscription_active,created_at")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function POST(req) {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const email = (body?.email || "").trim().toLowerCase();
  const subscriptionActive = Boolean(body?.subscription_active);
  if (!email) return Response.json({ error: "Email is required" }, { status: 400 });

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("allowed_users")
    .upsert(
      { email, subscription_active: subscriptionActive },
      { onConflict: "email" },
    )
    .select("id,email,subscription_active,created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function PATCH(req) {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const id = Number(body?.id);
  const subscriptionActive = Boolean(body?.subscription_active);
  if (!id) return Response.json({ error: "Id is required" }, { status: 400 });

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("allowed_users")
    .update({ subscription_active: subscriptionActive })
    .eq("id", id)
    .select("id,email,subscription_active,created_at")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ data });
}

export async function DELETE(req) {
  const authorized = await isAuthorizedAdmin();
  if (!authorized) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  if (!id) return Response.json({ error: "Id is required" }, { status: 400 });

  const supabase = createSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { error } = await supabase.from("allowed_users").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
