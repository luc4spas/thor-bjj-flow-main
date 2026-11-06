import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Missing token" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: caller } = await admin
      .from("perfis").select("role").eq("id", userData.user.id).maybeSingle();
    if (!caller || !["owner", "admin"].includes(caller.role)) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const targetId = String(body.id ?? "");
    if (!targetId) return json({ error: "ID obrigatório" }, 400);
    if (targetId === userData.user.id) return json({ error: "Você não pode excluir a si mesmo" }, 400);

    const { data: target } = await admin
      .from("perfis").select("role").eq("id", targetId).maybeSingle();
    if (!target) return json({ error: "Usuário não encontrado" }, 404);

    // Apenas owner pode excluir owners
    if (target.role === "owner" && caller.role !== "owner") {
      return json({ error: "Apenas owner pode excluir outro owner" }, 403);
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return json({ error: delErr.message }, 400);
    // perfis tem cascade on delete (FK to auth.users)
    await admin.from("perfis").delete().eq("id", targetId);

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
