import { createClient } from "@supabase/supabase-js";
import { Database } from "../integrations/supabase/types";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { WebSocket as WSWebSocket } from "ws";

dotenv.config();

let supabaseUrl = process.env.VITE_SUPABASE_URL || "";
let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";

// Tenta ler o config.json local ou do diretório de dados do app
const configPath = process.env.APP_CONFIG_PATH || path.join(process.cwd(), "config.json");
if (fs.existsSync(configPath)) {
  try {
    const localConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (localConfig.VITE_SUPABASE_URL) supabaseUrl = localConfig.VITE_SUPABASE_URL;
    if (localConfig.VITE_SUPABASE_ANON_KEY) supabaseAnonKey = localConfig.VITE_SUPABASE_ANON_KEY;
  } catch (e) {
    console.error("Erro ao ler config.json:", e);
  }
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Faltando variáveis do Supabase. Configure via interface web ou .env");
}

let supabaseClient: any = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    new URL(supabaseUrl);
    if (!globalThis.WebSocket) {
      globalThis.WebSocket = WSWebSocket as any;
    }
    
    supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      }
    });
  } catch (err: any) {
    console.error("Erro ao inicializar Supabase. Verifique a URL e a Anon Key no config.json:", err.message);
  }
}

export const supabase = supabaseClient;

export async function loginSupabase(email: string, password: string) {
  if (!supabase) throw new Error("Supabase não inicializado. Verifique a URL e a Chave Pública (Anon Key).");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function insertCheckin(enrollid: number, time: string) {
  if (!supabase) {
    console.log(`[DRY RUN] Received checkin for enrollid: ${enrollid} at ${time}. Supabase client not initialized.`);
    return;
  }

  console.log(`Received checkin for enrollid: ${enrollid} at ${time}`);

  // Fetch the aluno id using matricula (which maps to enrollid)
  const { data: aluno, error: err } = await supabase
    .from('alunos')
    .select('id')
    .eq('matricula', String(enrollid)) // the column might be string or int, so we can cast to string if needed, wait Supabase will convert automatically. Let's pass enrollid as is
    .limit(1)
    .maybeSingle();

  if (err || !aluno) {
    console.error(`Aluno with matricula ${enrollid} not found:`, err?.message);
    return;
  }

  const { error } = await supabase
    .from("checkins")
    .insert({
      id_aluno: aluno.id,
      data_hora: time,
      origem: "catraca",
      observacao: "Acesso via catraca"
    });
    
  if (error) {
    console.error("Error inserting checkin:", error);
  } else {
    console.log("Checkin inserted successfully for", aluno.id);
  }
}

