import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import cors from "cors";
import http from "http";
import os from "os";
import fs from "fs";
import path from "path";
import open from "open";
import { handleMessage } from "./handlers";
import { supabase, loginSupabase } from "./db";

const PORT = 3001;
const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let activeDevice: WebSocket | null = null;
let deviceIp: string | null = null;

const configPath = process.env.APP_CONFIG_PATH || path.join(process.cwd(), "config.json");

// HTTP API Endpoints for frontend (Vite)
app.get("/api/catraca/status", (req, res) => {
  res.json({
    connected: activeDevice !== null && activeDevice.readyState === WebSocket.OPEN,
    deviceIp: deviceIp,
  });
});

app.post("/api/catraca/open", async (req, res) => {
  // Alterado para utilizar a API HTTP da catraca diretamente (bypass do WebSocket)
  const catracaIp = "10.0.0.4"; // IP Fixo da Catraca para testes
  const pwd = "123";

  try {
    const response = await fetch(`http://${catracaIp}/api`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': `pwd=${pwd}; deviceid=1;` 
      },
      body: JSON.stringify({ cmd: 'opendoor', doornum: 1, password: pwd })
    });

    const data = await response.json();
    
    if (data.result === true) {
      res.json({ success: true, message: "Comando HTTP enviado e porta aberta!" });
    } else {
      res.status(400).json({ success: false, message: "Catraca respondeu, mas falhou: " + JSON.stringify(data) });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Erro de rede ao falar com a catraca: " + error.message });
  }
});

app.post("/api/catraca/face", (req, res) => {
  const { enrollid, name, base64 } = req.body;
  if (!enrollid || !base64) {
    return res.status(400).json({ success: false, message: "Falta enrollid ou base64." });
  }
  if (activeDevice && activeDevice.readyState === WebSocket.OPEN) {
    const payload = {
      cmd: "setuserinfo",
      enrollid: Number(enrollid),
      name: name || `Aluno ${enrollid}`,
      backupnum: 50,
      admin: 0,
      record: base64,
    };
    activeDevice.send(JSON.stringify(payload));
    res.json({ success: true, message: "Foto enviada para a catraca." });
  } else {
    res.status(400).json({ success: false, message: "Catraca não conectada." });
  }
});

// Local GUI Endpoints
app.get("/api/sys/ip", (req, res) => {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === "IPv4" && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  res.json({ ips });
});

app.get("/api/sys/config", (req, res) => {
  let conf = { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" };
  if (fs.existsSync(configPath)) {
    try {
      conf = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (e) {}
  }
  res.json(conf);
});

app.post("/api/sys/config", (req, res) => {
  const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } = req.body;
  try {
    fs.writeFileSync(configPath, JSON.stringify({ VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY }, null, 2));
    res.json({ success: true });
    // Note: requires restart to apply in db.ts since it's loaded once, but for simplicity we just save it.
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/sys/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const data = await loginSupabase(email, password);
    res.json({ success: true, user: data.user });
  } catch (e: any) {
    res.status(401).json({ success: false, error: e.message });
  }
});

app.get("/api/sys/alunos", async (req, res) => {
  const { search } = req.query;
  if (!search || typeof search !== 'string') return res.json([]);
  
  try {
    const db = await import("./db.js");
    const { data, error } = await db.supabase
      .from('alunos')
      .select('id, nome, matricula')
      .ilike('nome', `%${search}%`)
      .limit(10);
      
    if (error) throw error;
    res.json(data || []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/login", (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Servidor Catraca</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>body { background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }</style>
</head>
<body class="p-8 flex items-center justify-center min-h-screen">
    <div class="max-w-md w-full bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h1 class="text-2xl font-bold text-gray-800 text-center mb-2">Thor BJJ Flow</h1>
        <p class="text-gray-500 text-center mb-6">Acesso ao Servidor da Catraca</p>
        
        <form id="login-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input type="email" id="email" required class="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="admin@thorbjj.com">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <input type="password" id="password" required class="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none">
            </div>
            <button type="submit" id="btn-login" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors mt-2">
                Entrar
            </button>
            <p id="error-msg" class="text-sm text-red-500 hidden text-center mt-2"></p>
        </form>
    </div>

    <script>
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btn = document.getElementById('btn-login');
            const errorMsg = document.getElementById('error-msg');
            
            btn.disabled = true;
            btn.textContent = "Autenticando...";
            errorMsg.classList.add('hidden');
            
            fetch('/api/sys/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })
            .then(r => r.json())
            .then(d => {
                if(d.success) {
                    window.location.href = '/config';
                } else {
                    errorMsg.textContent = d.error || "E-mail ou senha inválidos.";
                    errorMsg.classList.remove('hidden');
                    btn.disabled = false;
                    btn.textContent = "Entrar";
                }
            })
            .catch(err => {
                errorMsg.textContent = "Erro de conexão.";
                errorMsg.classList.remove('hidden');
                btn.disabled = false;
                btn.textContent = "Entrar";
            });
        });
    </script>
</body>
</html>`;
  res.send(html);
});

// Local GUI HTML
app.get("/config", (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuração da Catraca</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    </style>
</head>
<body class="p-8">
    <div class="max-w-3xl mx-auto space-y-6">
        <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h1 class="text-2xl font-bold text-gray-800">Servidor da Catraca</h1>
            <p class="text-gray-500 mt-1">Este computador está aguardando conexões do equipamento físico.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 class="text-lg font-semibold text-gray-800 mb-4">Como conectar a catraca?</h2>
                <p class="text-sm text-gray-600 mb-4">Vá no menu físico da catraca e configure o IP do Servidor para um dos IPs abaixo, usando a porta <b>3001</b>.</p>
                
                <div id="ip-list" class="space-y-2"></div>
                
                <div class="mt-6 p-4 rounded-lg bg-gray-50 flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-800">Status da Conexão</p>
                        <p id="conn-status" class="text-xs text-red-500 font-semibold mt-1">Nenhuma catraca conectada</p>
                        <p id="conn-ip" class="text-xs text-gray-500 mt-1"></p>
                    </div>
                    <div id="conn-indicator" class="w-3 h-3 rounded-full bg-red-500"></div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h2 class="text-lg font-semibold text-gray-800 mb-4">Teste de Cadastro Remoto (Câmera)</h2>
                <p class="text-sm text-gray-600 mb-4">Busque o aluno pelo nome no Supabase para disparar a câmera.</p>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-700 mb-1">Buscar Aluno</label>
                        <input type="text" id="search-name" class="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Digite o nome..." onkeyup="searchAlunos()">
                        <div id="search-results" class="mt-1 bg-white border rounded-md shadow-sm hidden max-h-32 overflow-y-auto"></div>
                    </div>
                    
                    <div id="selected-aluno-container" class="hidden p-3 bg-blue-50 border border-blue-100 rounded-md">
                        <p class="text-xs text-blue-800 font-medium">Aluno Selecionado:</p>
                        <p id="selected-aluno-name" class="text-sm font-bold text-blue-900"></p>
                        <p id="selected-aluno-mat" class="text-xs text-blue-700">Matrícula: <span></span></p>
                        <input type="hidden" id="test-enrollid">
                    </div>

                    <button id="btn-enroll" onclick="testRemoteEnroll()" disabled class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md text-sm transition-colors">
                        Ativar Câmera da Catraca
                    </button>
                    
                    <button onclick="testOpenDoor()" class="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors mt-2">
                        Abrir Porta (Teste HTTP)
                    </button>
                </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
                <h2 class="text-lg font-semibold text-gray-800 mb-4">Configuração da Nuvem (Supabase)</h2>
                <p class="text-sm text-gray-600 mb-4">Insira as chaves do seu banco de dados para conectar a catraca.</p>
                
                <form id="config-form" class="space-y-4">
                    <div>
                        <label class="block text-xs font-medium text-gray-700 mb-1">Supabase URL</label>
                        <input type="text" id="supabase-url" class="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://xyz.supabase.co">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-700 mb-1">Anon Key (Chave Pública)</label>
                        <input type="password" id="supabase-key" class="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="eyJhbGci...">
                    </div>
                    <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors">
                        Salvar Configurações
                    </button>
                    <p id="save-msg" class="text-xs text-green-600 hidden text-center">Salvo com sucesso! Reinicie o aplicativo.</p>
                </form>
            </div>
        </div>
    </div>

    <script>
        // Fetch IPs
        fetch('/api/sys/ip').then(r=>r.json()).then(d => {
            const list = document.getElementById('ip-list');
            if (d.ips.length === 0) list.innerHTML = '<p class="text-sm text-gray-500">Nenhum IP de rede encontrado.</p>';
            d.ips.forEach(ip => {
                list.innerHTML += \`<div class="bg-blue-50 text-blue-700 px-3 py-2 rounded-md font-mono text-sm font-medium">\${ip}</div>\`;
            });
        });

        // Fetch Config
        fetch('/api/sys/config').then(r=>r.json()).then(d => {
            document.getElementById('supabase-url').value = d.VITE_SUPABASE_URL || '';
            document.getElementById('supabase-key').value = d.VITE_SUPABASE_ANON_KEY || '';
        });

        // Save Config
        document.getElementById('config-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const VITE_SUPABASE_URL = document.getElementById('supabase-url').value;
            const VITE_SUPABASE_ANON_KEY = document.getElementById('supabase-key').value;
            fetch('/api/sys/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY })
            }).then(r=>r.json()).then(d => {
                if (d.success) {
                    const msg = document.getElementById('save-msg');
                    msg.classList.remove('hidden');
                    setTimeout(() => msg.classList.add('hidden'), 3000);
                }
            });
        });

        // Poll Status
        setInterval(() => {
            fetch('/api/catraca/status').then(r=>r.json()).then(d => {
                const status = document.getElementById('conn-status');
                const ipTxt = document.getElementById('conn-ip');
                const indicator = document.getElementById('conn-indicator');
                if (d.connected) {
                    status.textContent = 'Catraca Conectada e Online';
                    status.className = 'text-xs text-green-600 font-semibold mt-1';
                    indicator.className = 'w-3 h-3 rounded-full bg-green-500 animate-pulse';
                    ipTxt.textContent = 'IP: ' + (d.deviceIp || 'Desconhecido');
                } else {
                    status.textContent = 'Nenhuma catraca conectada';
                    status.className = 'text-xs text-red-500 font-semibold mt-1';
                    indicator.className = 'w-3 h-3 rounded-full bg-red-500';
                    ipTxt.textContent = '';
                }
            }).catch(()=>{});
        }, 3000);

        let searchTimeout;
        function searchAlunos() {
            clearTimeout(searchTimeout);
            const query = document.getElementById('search-name').value;
            const resultsDiv = document.getElementById('search-results');
            if (query.length < 2) {
                resultsDiv.classList.add('hidden');
                return;
            }
            searchTimeout = setTimeout(() => {
                fetch('/api/sys/alunos?search=' + encodeURIComponent(query))
                    .then(r=>r.json())
                    .then(data => {
                        resultsDiv.innerHTML = '';
                        if (data.length === 0) {
                            resultsDiv.innerHTML = '<div class="p-2 text-sm text-gray-500">Nenhum aluno encontrado</div>';
                        } else {
                            data.forEach(aluno => {
                                const div = document.createElement('div');
                                div.className = 'p-2 border-b last:border-0 hover:bg-gray-50 cursor-pointer text-sm';
                                div.innerHTML = '<span class="font-medium">' + aluno.nome + '</span> <span class="text-xs text-gray-500 ml-2">Matrícula: ' + (aluno.matricula || 'Sem mat.') + '</span>';
                                div.onclick = () => selectAluno(aluno);
                                resultsDiv.appendChild(div);
                            });
                        }
                        resultsDiv.classList.remove('hidden');
                    });
            }, 300);
        }

        function selectAluno(aluno) {
            if (!aluno.matricula) {
                alert('Esse aluno ainda não tem matrícula (rode o comando SQL para gerar se for antigo)');
                return;
            }
            document.getElementById('search-results').classList.add('hidden');
            document.getElementById('search-name').value = '';
            
            document.getElementById('selected-aluno-container').classList.remove('hidden');
            document.getElementById('selected-aluno-name').textContent = aluno.nome;
            document.getElementById('selected-aluno-mat').querySelector('span').textContent = aluno.matricula;
            document.getElementById('test-enrollid').value = aluno.matricula;
            
            document.getElementById('btn-enroll').disabled = false;
        }

        function testRemoteEnroll() {
            const enrollid = document.getElementById('test-enrollid').value;
            if (!enrollid) {
                alert('Selecione um aluno para testar.');
                return;
            }
            fetch('/api/catraca/enroll', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ enrollid })
            }).then(r=>r.json()).then(d => {
                alert(d.message);
            }).catch(e => {
                alert('Erro ao enviar comando: ' + e.message);
            });
        }

        function testOpenDoor() {
            fetch('/api/catraca/open', {
                method: 'POST'
            }).then(r=>r.json()).then(d => {
                alert(d.message);
            }).catch(e => {
                alert('Erro: ' + e.message);
            });
        }
    </script>
</body>
</html>
  `;
  res.send(html);
});

let lastSeenAt: number = 0;
let lastProcessedTime: string = ""; // Para evitar logs duplicados

// Start HTTP polling to Catraca
function startCatracaPolling() {
  setInterval(async () => {
    const catracaIp = "10.0.0.4";
    const pwd = "123";
    
    try {
      const response = await fetch(`http://${catracaIp}/api`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': `pwd=${pwd}; deviceid=1;` 
        },
        body: JSON.stringify({ cmd: 'getrtlog', password: pwd }),
        signal: AbortSignal.timeout(2500)
      });

      if (response.ok) {
        deviceIp = catracaIp;
        lastSeenAt = Date.now();
        
        const data = await response.json();
        
        if (data.result && data.record && Array.isArray(data.record) && data.record.length > 0) {
          for (const record of data.record) {
            // Deduplicação super simples
            if (record.time > lastProcessedTime) {
              console.log(`Novo acesso na catraca: ${record.name} (${record.enrollid}) às ${record.time}`);
              lastProcessedTime = record.time;
              
              // Processar o checkin no banco
              try {
                // Import dinâmico
                const db = await import("./db.js");
                await db.insertCheckin(record.enrollid, record.time);
              } catch (e) {
                console.error("Erro ao salvar checkin:", e);
              }
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'TimeoutError' && e.name !== 'AbortError') {
         console.error("Erro no polling HTTP:", e.message);
      }
    }
  }, 3000);
}

// HTTP API Endpoints for frontend (Vite)
app.get("/api/catraca/status", (req, res) => {
  res.json({
    connected: Date.now() - lastSeenAt < 10000,
    deviceIp: deviceIp,
  });
});

app.post("/api/catraca/open", async (req, res) => {
  const catracaIp = "10.0.0.4"; // IP Fixo da Catraca para testes
  const pwd = "123";

  try {
    const response = await fetch(`http://${catracaIp}/api`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': `pwd=${pwd}; deviceid=1;` 
      },
      body: JSON.stringify({ cmd: 'opendoor', doornum: 1, password: pwd })
    });

    const data = await response.json();
    
    if (data.result === true) {
      res.json({ success: true, message: "Comando HTTP enviado e porta aberta!" });
    } else {
      res.status(400).json({ success: false, message: "Catraca respondeu, mas falhou: " + JSON.stringify(data) });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Erro de rede ao falar com a catraca: " + error.message });
  }
});

app.post("/api/catraca/enroll", async (req, res) => {
  const { enrollid, name } = req.body;
  if (!enrollid) return res.status(400).json({ success: false, message: "Faltando enrollid" });

  const catracaIp = "10.0.0.4"; 
  const pwd = "123";

  try {
    if (name) {
      await fetch(`http://${catracaIp}/api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': `pwd=${pwd}; deviceid=1;` },
        body: JSON.stringify({ 
          cmd: 'setuserinfo', 
          enrollid, 
          name: name.substring(0, 20),
          admin: 0, card: 0, departmant: "", groupid: 0, pwd: 0, shiftid: 0, verifymode: 0, zoneid: 0,
          password: pwd 
        }),
        signal: AbortSignal.timeout(3000)
      }).catch(console.error); // Ignore errors here, just try to set the name
    }

    // Tentar cancelar qualquer registro em andamento para destravar a catraca ("device is working")
    await fetch(`http://${catracaIp}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pwd=${pwd}; deviceid=1;` },
      body: JSON.stringify({ cmd: 'cancelreg', password: pwd }),
      signal: AbortSignal.timeout(2000)
    }).catch(console.error);

    const response = await fetch(`http://${catracaIp}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pwd=${pwd}; deviceid=1;` },
      body: JSON.stringify({ cmd: 'adduser', flag: 2, enrollid, backupnum: 50, password: pwd }),
      signal: AbortSignal.timeout(3000)
    });
    const data = await response.json();
    console.log("[ENROLL RESPONSE]", data);
    if (data.result !== false) {
      res.json({ success: true, message: "Câmera ativada com sucesso!" });
    } else {
      res.status(400).json({ success: false, message: "Catraca falhou: " + JSON.stringify(data) });
    }
  } catch (error: any) {
    console.error("[ENROLL ERROR]", error.message);
    res.status(500).json({ success: false, message: "Erro de rede: " + error.message });
  }
});

app.get("/api/catraca/enroll-status", async (req, res) => {
  const catracaIp = "10.0.0.4";
  const pwd = "123";

  try {
    const response = await fetch(`http://${catracaIp}/api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `pwd=${pwd}; deviceid=1;` },
      body: JSON.stringify({ cmd: 'checkregstatus', password: pwd }),
      signal: AbortSignal.timeout(2000)
    });
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/catraca/sync", async (req, res) => {
  const catracaIp = "10.0.0.4";
  const pwd = "123";

  try {
    const db = await import("./db.js");
    const { data: alunos, error: errAlunos } = await db.supabase
      .from("alunos")
      .select("id, nome, cpf, matricula");
      
    if (errAlunos) throw errAlunos;
    
    const { data: transacoes, error: errTrans } = await db.supabase
      .from("transacoes")
      .select("id_aluno, status, data_vencimento, tipo");
      
    if (errTrans) throw errTrans;

    if (!alunos) return res.json({ success: true, message: "Nenhum aluno encontrado." });

    let synced = 0;
    let failed = 0;

    const today = new Date().toISOString().slice(0, 10);

    for (const aluno of alunos) {
      const enrollid = aluno.matricula;
      if (!enrollid) continue;

      try {
        const ts = (transacoes ?? []).filter((t: any) => t.id_aluno === aluno.id && t.tipo === "receita");
        const atrasado = ts.some((t: any) => t.status === "pendente" && t.data_vencimento < today);
        const isActive = !atrasado;
        
        if (isActive) {
          // Atualiza dados na catraca
          await fetch(`http://${catracaIp}/api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': `pwd=${pwd}; deviceid=1;` },
            body: JSON.stringify({ 
              cmd: 'setuserinfo', 
              enrollid, 
              name: aluno.nome.substring(0, 20),
              admin: 0, card: 0, departmant: "", groupid: 0, pwd: 0, shiftid: 0, verifymode: 0, zoneid: 0,
              password: pwd
            }),
            signal: AbortSignal.timeout(2500)
          });
        } else {
          // Remove acesso (status inativo)
          await fetch(`http://${catracaIp}/api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': `pwd=${pwd}; deviceid=1;` },
            body: JSON.stringify({ 
              cmd: 'deleteusers', 
              list: [enrollid],
              password: pwd
            }),
            signal: AbortSignal.timeout(2500)
          });
        }
        synced++;
      } catch (err) {
        failed++;
        console.error(`Erro ao sincronizar aluno ${aluno.id}:`, err);
      }
    }

    res.json({ success: true, message: `Sincronização concluída: ${synced} sincronizados, ${failed} falhas.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Erro ao sincronizar: " + error.message });
  }
});

app.get("/api/sys/debug-alunos", async (req, res) => {
  try {
    const db = await import("./db.js");
    const { data, error } = await db.supabase.from("alunos").select("id, nome, cpf, matricula");
    res.json({ data, error });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Sync Loop com Supabase
function startSyncLoop() {
  setInterval(async () => {
    try {
      const db = await import("./db.js");
      const { data: alunos, error } = await db.supabase
        .from("alunos")
        .select("id, nome, cpf, matricula");
        
      if (error) throw error;
      if (!alunos || !deviceIp) return;

      const catracaIp = "10.0.0.4";
      const pwd = "123";

      for (const aluno of alunos) {
        // Temporariamente desativando a exclusão até confirmarmos a regra de negócio
        // e o campo correto de matrícula/status.
        const enrollid = aluno.matricula;
        if (!enrollid) continue;

        if (true) { // Ativo (placeholder)
          // Adiciona ou atualiza na catraca
          await fetch(`http://${catracaIp}/api`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': `pwd=${pwd}; deviceid=1;` },
            body: JSON.stringify({ 
              cmd: 'setuserinfo', 
              enrollid: enrollid, 
              name: aluno.nome.substring(0, 20), // Truncate to avoid overflow
              password: pwd
            }),
            signal: AbortSignal.timeout(2500)
          }).catch(()=>{});
        }
      }
    } catch (e: any) {
      console.error("Erro no sync loop:", e.message);
    }
  }, 60000); // Roda a cada 1 minuto
}

export function startCatracaServer() {
  startCatracaPolling();
  startSyncLoop();



  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Catraca Server (HTTP + WS) running on port ${PORT}`);
    console.log(`Configuration UI available at: http://localhost:${PORT}/config`);
    
    // Auto-open browser in standalone mode (only if not running inside Electron)
    if (!process.versions.electron) {
      try {
        await open(`http://localhost:${PORT}/config`);
      } catch (e) {
        console.log("Could not open browser automatically.");
      }
    }
  }).on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`\n=========================================\nERRO FATAL: A porta ${PORT} já está em uso.\n=========================================`);
      console.error("Isso geralmente acontece porque já existe outra versão do CatracaBJJ.exe rodando.");
      console.error("Por favor, feche a versão anterior (pelo Gerenciador de Tarefas se necessário) e tente abrir novamente.\n");
      // Mantenha o processo vivo por alguns segundos para o usuário conseguir ler a mensagem
      setTimeout(() => process.exit(1), 10000);
    } else {
      console.error("Erro no servidor:", e);
    }
  });

  return { server, wss };
}

// Inicia o servidor sempre que este arquivo for executado
startCatracaServer();
