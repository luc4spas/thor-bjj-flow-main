import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/protected-route";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Activity, DoorOpen, HardDrive, Wifi, WifiOff, Users, Settings, UserPlus, Search, Camera, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/catraca")({
  component: () => (
    <ProtectedRoute allow={["owner", "admin"]}>
      <CatracaDashboard />
    </ProtectedRoute>
  ),
});

function CatracaDashboard() {
  const [deviceStatus, setDeviceStatus] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"monitor" | "cadastro" | "config">("monitor");
  const [searchQuery, setSearchQuery] = useState("");
  const [alunosBusca, setAlunosBusca] = useState<any[]>([]);

  // Poll device status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/catraca/status");
        if (res.ok) {
          const data = await res.json();
          setDeviceStatus(data.connected);
        } else {
          setDeviceStatus(false);
        }
      } catch (e) {
        setDeviceStatus(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch recent checkins
  const { data: checkins, refetch } = useQuery({
    queryKey: ["catraca-checkins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkins")
        .select(`
          id, data_hora, origem, observacao, id_aluno,
          alunos ( nome )
        `)
        .order("data_hora", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Subscribe to real-time checkins
  useEffect(() => {
    const channel = supabase
      .channel("checkins-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checkins" },
        () => {
          refetch();
          toast.success("Novo acesso registrado!");
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetch]);

  const handleOpenDoor = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/catraca/open", { method: "POST" });
      if (res.ok) toast.success("Comando enviado para a catraca abrir a porta!");
      else toast.error("Erro: Catraca não está conectada.");
    } catch (e) {
      toast.error("Erro ao comunicar com o servidor da catraca.");
    }
  };

  const buscarAluno = async () => {
    if (!searchQuery || searchQuery.length < 2) return;
    try {
      const { data, error } = await supabase
        .from("alunos")
        .select("id, nome, cpf, matricula")
        .ilike("nome", `%${searchQuery}%`)
        .limit(5);
      if (error) throw error;
      setAlunosBusca(data || []);
    } catch (e) {
      toast.error("Erro ao buscar aluno");
    }
  };

  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState("");
  const [enrollImage, setEnrollImage] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Polling do status do cadastro apenas se estiver matriculando
    if (!isEnrolling) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:3001/api/catraca/enroll-status");
        const data = await res.json();
        
        if (data.msg) {
          setEnrollStatus(data.msg);
        }
        
        if (data.image) {
          setEnrollImage(`data:image/jpeg;base64,${data.image}`);
        }

        // Se cadastrou com sucesso (status 100 pode ser sucesso, ou algo similar)
        if (data.status === 100) {
          setIsEnrolling(false);
          toast.success("Facial cadastrada com sucesso!");
        }
      } catch (e) {
        console.error(e);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isEnrolling]);

  const sincronizar = async () => {
    setIsSyncing(true);
    toast.info("Iniciando sincronização...");
    try {
      const res = await fetch("http://localhost:3001/api/catraca/sync", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.message || "Erro ao sincronizar.");
      }
    } catch (e) {
      toast.error("Erro de rede ao sincronizar com a catraca.");
    } finally {
      setIsSyncing(false);
    }
  };

  const acionarCamera = async (aluno: any) => {
    let idParaEnviar = aluno.matricula;
    if (!idParaEnviar) {
      toast.warning("Aluno sem matrícula! Usando ID 999 para teste da câmera.");
      idParaEnviar = 999;
    }
    
    setEnrollStatus("Iniciando câmera...");
    setEnrollImage("");
    try {
      const res = await fetch("http://localhost:3001/api/catraca/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollid: idParaEnviar, name: aluno.nome })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        setIsEnrolling(true);
      } else {
        toast.error(data.message || "Erro ao acionar câmera.");
      }
    } catch (e) {
      toast.error("Erro de rede ao comunicar com o servidor.");
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] border-t overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/20 flex flex-col p-4 space-y-2">
        <h2 className="text-lg font-bold mb-4 tracking-tight px-2">Catraca Local</h2>
        <Button 
          variant={activeTab === "monitor" ? "secondary" : "ghost"} 
          className="justify-start gap-3"
          onClick={() => setActiveTab("monitor")}
        >
          <Activity className="h-4 w-4" /> Monitoramento
        </Button>
        <Button 
          variant={activeTab === "cadastro" ? "secondary" : "ghost"} 
          className="justify-start gap-3"
          onClick={() => setActiveTab("cadastro")}
        >
          <UserPlus className="h-4 w-4" /> Cadastrar Facial
        </Button>
        <Button 
          variant={activeTab === "alunos" ? "secondary" : "ghost"} 
          className="justify-start gap-3"
          onClick={() => setActiveTab("alunos")}
        >
          <Users className="h-4 w-4" /> Alunos & Faces
        </Button>
        <Button 
          variant={activeTab === "config" ? "secondary" : "ghost"} 
          className="justify-start gap-3"
          onClick={() => setActiveTab("config")}
        >
          <Settings className="h-4 w-4" /> Configurações
        </Button>

        <div className="flex-1" />

        <Button 
          variant="outline" 
          className="justify-start gap-3 mt-auto border-blue-500 text-blue-500 hover:bg-blue-50"
          onClick={sincronizar}
          disabled={isSyncing}
        >
          <RefreshCcw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} /> 
          {isSyncing ? "Sincronizando..." : "Sincronizar Catraca"}
        </Button>

        <div className="mt-auto pt-6 px-2">
          <div className="flex items-center gap-3">
            {deviceStatus ? (
              <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse" />
            ) : (
              <div className="h-3 w-3 bg-red-500 rounded-full" />
            )}
            <span className="text-sm font-medium">
              {deviceStatus ? "Catraca Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
        
        {activeTab === "monitor" && (
          <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Monitoramento ao Vivo</h1>
                <p className="text-muted-foreground text-sm">Acessos registrados e validados pelo sistema.</p>
              </div>
              <Button onClick={handleOpenDoor} className="gap-2 bg-green-600 hover:bg-green-700">
                <DoorOpen className="h-4 w-4" />
                Liberar Acesso Manual
              </Button>
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b bg-muted/10">
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Feed de Passagens
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {checkins?.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum acesso hoje.</p>
                  )}
                  {checkins?.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                          {((c.alunos as any)?.nome?.[0]) || "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{(c.alunos as any)?.nome || "Aluno Desconhecido"}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Liberado</span>
                            <span>Catraca Local</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500 font-medium font-mono">
                        {new Date(c.data_hora).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "cadastro" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Cadastro Biométrico</h1>
              <p className="text-muted-foreground text-sm">Busque o aluno para abrir a câmera da catraca e registrar o rosto.</p>
            </div>

            <Card className="shadow-sm">
              <CardContent className="p-6 space-y-6">
                <div className="flex gap-3">
                  <Input 
                    placeholder="Nome do aluno..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && buscarAluno()}
                    className="flex-1"
                  />
                  <Button onClick={buscarAluno} variant="secondary">
                    <Search className="h-4 w-4 mr-2" /> Buscar
                  </Button>
                </div>

                {alunosBusca.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {alunosBusca.map(aluno => (
                      <div key={aluno.id} className="p-4 flex flex-col hover:bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{aluno.nome}</p>
                            <p className="text-sm text-muted-foreground">Matrícula: {aluno.matricula || "Sem matrícula"}</p>
                          </div>
                          <Button 
                            onClick={() => acionarCamera(aluno)}
                            disabled={isEnrolling}
                            className="gap-2"
                          >
                            <Camera className="h-4 w-4" /> 
                            {isEnrolling ? "Aguardando..." : "Capturar"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Status do Cadastro (Aparece ao clicar em Capturar) */}
                {(isEnrolling || enrollStatus || enrollImage) && (
                  <div className="mt-6 p-6 border rounded-lg bg-muted/20 flex flex-col items-center justify-center space-y-4">
                    {enrollStatus && (
                      <p className="text-lg font-medium animate-pulse">{enrollStatus}</p>
                    )}
                    {enrollImage ? (
                      <div className="rounded-xl overflow-hidden border-4 border-green-500 shadow-xl">
                        <img src={enrollImage} alt="Rosto Cadastrado" className="w-48 h-48 object-cover" />
                      </div>
                    ) : (
                      isEnrolling && (
                        <div className="w-48 h-48 bg-muted rounded-xl border-2 border-dashed flex items-center justify-center flex-col">
                          <Camera className="h-10 w-10 text-muted-foreground mb-2 animate-bounce" />
                          <span className="text-xs text-muted-foreground text-center px-4">Aguardando câmera...</span>
                        </div>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "config" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Configurações do Hardware</h1>
              <p className="text-muted-foreground text-sm">Status da comunicação com o equipamento físico.</p>
            </div>
            
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Catraca AI-Face</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">Status da Conexão</p>
                    <p className="text-sm text-muted-foreground">O computador está sondando a catraca localmente (IP 10.0.0.4).</p>
                  </div>
                  {deviceStatus ? (
                    <Wifi className="h-6 w-6 text-green-500" />
                  ) : (
                    <WifiOff className="h-6 w-6 text-red-500" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
