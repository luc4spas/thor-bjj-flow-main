import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Endpoint público chamado pela catraca física.
// Autenticação: header X-Catraca-Secret == process.env.CATRACA_SECRET
//
// POST body JSON:
//   { "aluno_id": "<uuid>" }  ou  { "cpf": "000.000.000-00" }
//
// Retorna:
//   200 { ok:true, aluno:{id,nome}, financeiro_ok:boolean, mensagem }
//   401 se assinatura inválida
//   404 se aluno não encontrado
//   402 se financeiro pendente (catraca deve bloquear)
export const Route = createFileRoute("/api/public/catraca")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-catraca-secret") ?? "";
        const expected = process.env.CATRACA_SECRET ?? "";
        if (!expected || secret !== expected) {
          return json({ error: "unauthorized" }, 401);
        }

        let body: { aluno_id?: string; cpf?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        // localiza aluno
        let alunoQuery = supabase.from("alunos").select("id,nome,titular_id").limit(1);
        if (body.aluno_id) alunoQuery = alunoQuery.eq("id", body.aluno_id);
        else if (body.cpf) alunoQuery = alunoQuery.eq("cpf", body.cpf);
        else return json({ error: "missing_identifier" }, 400);

        const { data: alunos, error: ea } = await alunoQuery;
        if (ea) return json({ error: ea.message }, 500);
        const aluno = alunos?.[0];
        if (!aluno) return json({ error: "aluno_nao_encontrado" }, 404);

        // status financeiro: se dependente de família, checa o titular
        const alvoFinanceiro = aluno.titular_id ?? aluno.id;
        const today = new Date().toISOString().slice(0, 10);
        const { data: pend } = await supabase
          .from("transacoes")
          .select("id")
          .eq("id_aluno", alvoFinanceiro)
          .eq("tipo", "receita")
          .eq("status", "pendente")
          .lt("data_vencimento", today)
          .limit(1);

        const financeiro_ok = !pend || pend.length === 0;

        // registra check-in apenas se liberado
        if (financeiro_ok) {
          await supabase.from("checkins").insert({
            id_aluno: aluno.id,
            origem: "catraca",
          });
        }

        return json({
          ok: financeiro_ok,
          aluno: { id: aluno.id, nome: aluno.nome },
          financeiro_ok,
          mensagem: financeiro_ok
            ? `Acesso liberado — ${aluno.nome}`
            : `Acesso bloqueado — mensalidade em atraso`,
        }, financeiro_ok ? 200 : 402);
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
