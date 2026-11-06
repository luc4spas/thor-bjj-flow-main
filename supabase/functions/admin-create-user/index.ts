// Edge function to create users by an admin/owner without disturbing their session.
// Uses the service role key to call auth.admin.createUser, then sets the role in `perfis`.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "owner" | "admin" | "instructor";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Missing token" }, 401);

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Check caller role
    const { data: perfil } = await admin
      .from("perfis").select("role").eq("id", userData.user.id).maybeSingle();
    if (!perfil || !["owner", "admin"].includes(perfil.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const nome = String(body.nome ?? "").trim();
    const role = (body.role as Role) ?? "instructor";

    if (!email || !password || password.length < 6) {
      return json({ error: "E-mail e senha (mín. 6) obrigatórios" }, 400);
    }
    if (!["owner", "admin", "instructor"].includes(role)) {
      return json({ error: "Perfil inválido" }, 400);
    }
    // Apenas owner pode criar outro owner
    if (role === "owner" && perfil.role !== "owner") {
      return json({ error: "Apenas o owner pode criar outro owner" }, 403);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password,
      email_confirm: true,
      user_metadata: { nome: nome || email.split("@")[0] },
    });
    if (createErr || !created.user) return json({ error: createErr?.message ?? "Erro ao criar usuário" }, 400);

    // upsert perfil with desired role (trigger may have inserted with default)
    await admin.from("perfis").upsert({
      id: created.user.id,
      email,
      nome: nome || email.split("@")[0],
      role,
    });

    return json({ ok: true, id: created.user.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
