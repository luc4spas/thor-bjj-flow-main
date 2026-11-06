import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export interface CatracaFacialDialogProps {
  open: boolean;
  onOpenChange: (val: boolean) => void;
  alunoId: string;
  alunoNome: string;
  alunoCpf?: string;
  alunoMatricula?: string;
}

export function CatracaFacialDialog({ open, onOpenChange, alunoId, alunoNome, alunoCpf, alunoMatricula }: CatracaFacialDialogProps) {
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState("");
  const [enrollImage, setEnrollImage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // Polling do status da catraca
  useEffect(() => {
    if (!isEnrolling) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:3001/api/catraca/enroll-status");
        const data = await res.json();
        
        if (data.msg) setEnrollStatus(data.msg);
        
        if (data.image) {
          setEnrollImage(`data:image/jpeg;base64,${data.image}`);
        }

        if (data.status === 100) {
          setIsEnrolling(false);
          setIsSuccess(true);
          toast.success("Facial cadastrada com sucesso na catraca!");
        }
      } catch (e) {
        console.error("Erro no polling da catraca:", e);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isEnrolling]);

  const handleStartEnroll = async () => {
    let idParaEnviar = alunoMatricula;
    if (!idParaEnviar) {
      if (!alunoCpf) {
        toast.error("Aluno não possui Matrícula nem CPF cadastrado.");
        return;
      }
      idParaEnviar = alunoCpf.replace(/\D/g, '').substring(0, 8);
    }
    
    setIsEnrolling(true);
    setIsSuccess(false);
    setEnrollImage("");
    setEnrollStatus("Iniciando captura na catraca...");
    
    try {
      const res = await fetch("http://localhost:3001/api/catraca/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollid: idParaEnviar, name: alunoNome })
      });
      if (!res.ok) {
        toast.error("Erro ao enviar comando para a catraca.");
        setIsEnrolling(false);
      }
    } catch(e) {
      toast.error("Erro de conexão com o servidor local da catraca (porta 3001).");
      setIsEnrolling(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setIsEnrolling(false);
      setIsSuccess(false);
      setEnrollImage("");
      setEnrollStatus("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastro Facial: {alunoNome}</DialogTitle>
          <DialogDescription>
            Posicione o aluno na frente da catraca e clique em "Iniciar Captura" para registrar o rosto diretamente no equipamento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center gap-6 py-6">
          <div className="w-full bg-muted rounded-xl overflow-hidden aspect-video flex items-center justify-center border relative shadow-inner">
            
            {!isEnrolling && !enrollImage && !isSuccess && (
              <div className="flex flex-col items-center text-muted-foreground gap-3">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Camera className="w-8 h-8 text-blue-500" />
                </div>
                <p className="text-sm font-medium">Pronto para capturar</p>
              </div>
            )}
            
            {isEnrolling && !enrollImage && (
              <div className="flex flex-col items-center text-muted-foreground gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                <p className="text-sm font-medium animate-pulse">{enrollStatus || "Aguardando catraca..."}</p>
              </div>
            )}
            
            {enrollImage && (
              <img 
                src={enrollImage} 
                alt="Foto da catraca" 
                className="w-full h-full object-cover"
              />
            )}

            {isSuccess && !enrollImage && (
              <div className="flex flex-col items-center text-green-600 gap-3">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <p className="text-sm font-medium">Cadastrado com sucesso!</p>
              </div>
            )}
          </div>

          <div className="w-full">
            {isEnrolling && enrollStatus && enrollImage && (
              <p className="text-sm text-center text-blue-600 font-medium mb-4 animate-pulse">
                {enrollStatus}
              </p>
            )}
            
            <Button 
              onClick={handleStartEnroll} 
              disabled={isEnrolling} 
              className={`w-full gap-2 h-12 text-base shadow-sm ${isSuccess ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isEnrolling ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Aguardando catraca...
                </>
              ) : isSuccess ? (
                <>
                  <RefreshCw className="w-5 h-5" /> Tentar Novamente
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" /> Iniciar Captura na Catraca
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
