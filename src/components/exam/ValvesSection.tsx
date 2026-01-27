import { Heart } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect } from "react";

interface ValvesData {
  mitral: string;
  mitralEspessamento?: boolean;
  mitralVelocidadeMax?: string;
  mitralGradienteMax?: string;
  tricuspide: string;
  tricuspideEspessamento?: boolean;
  tricuspideVelocidadeMax?: string;
  tricuspideGradienteMax?: string;
  aortica: string;
  aorticaEspessamento?: boolean;
  aorticaVelocidadeMax?: string;
  aorticaGradienteMax?: string;
  pulmonar: string;
  pulmonarEspessamento?: boolean;
  pulmonarVelocidadeMax?: string;
  pulmonarGradienteMax?: string;
}

interface ValvesSectionProps {
  data: ValvesData;
  onChange: (data: ValvesData) => void;
  onTextChange: (text: string) => void;
  achados: string;
}

// Opções do dropdown principal
const valveOptions = [
  { value: "normal", label: "Normal" },
  { value: "insuficiencia-discreta", label: "Insuficiência Discreta" },
  { value: "insuficiencia-moderada", label: "Insuficiência Moderada" },
  { value: "insuficiencia-grave", label: "Insuficiência Importante" },
  { value: "estenose", label: "Estenose" },
  { value: "displasia", label: "Displasia" },
];

// Verifica se é uma opção de insuficiência
const isInsuficiencia = (status: string): boolean => {
  return status.startsWith("insuficiencia-");
};

// Verifica se deve mostrar checkbox de espessamento (Normal ou Insuficiências)
const showEspessamentoCheckbox = (status: string): boolean => {
  return status === "normal" || isInsuficiencia(status);
};

// Verifica se deve mostrar campos de estenose
const showEstenoseCampos = (status: string): boolean => {
  return status === "estenose";
};

// Retorna a estrutura anatômica correta
const getEstrutura = (valve: string): string => {
  // Mitral e Tricúspide usam "cúspides", Aórtica e Pulmonar usam "válvulas"
  if (valve === "mitral" || valve === "tricuspide") {
    return "cúspides";
  }
  return "válvulas";
};

// Retorna o grau da insuficiência em português
const getGrauInsuficiencia = (status: string): string => {
  const graus: Record<string, string> = {
    "insuficiencia-discreta": "discreto",
    "insuficiencia-moderada": "moderado",
    "insuficiencia-grave": "importante",
  };
  return graus[status] || "";
};

const getValveDescription = (
  valve: string,
  status: string,
  hasEspessamento: boolean,
  velocidadeMax?: string,
  gradienteMax?: string
): string => {
  const valveNames: Record<string, string> = {
    mitral: "mitral",
    tricuspide: "tricúspide",
    aortica: "aórtica",
    pulmonar: "pulmonar",
  };

  const valveName = valveNames[valve];
  const estrutura = getEstrutura(valve);

  // Caso 1: Normal
  if (status === "normal") {
    if (hasEspessamento) {
      return `Valva ${valveName} apresenta aspecto espessado e movimentação normais de suas ${estrutura}. O estudo Doppler e o mapeamento de fluxo em cores são normais.`;
    }
    return `Valva ${valveName} apresenta aspecto e movimentação normais de suas ${estrutura}. O estudo Doppler e o mapeamento de fluxo em cores são normais.`;
  }

  // Caso 2: Insuficiência (Discreta, Moderada, Importante)
  if (isInsuficiencia(status)) {
    const grau = getGrauInsuficiencia(status);
    
    // Parte 1 - Anatomia
    let parte1 = "";
    if (hasEspessamento) {
      parte1 = `Valva ${valveName} apresenta aspecto espessado e movimentação normais de suas ${estrutura}.`;
    } else {
      parte1 = `Valva ${valveName} apresenta aspecto e movimentação normais de suas ${estrutura}.`;
    }
    
    // Parte 2 - Doppler
    let parte2 = `O estudo Doppler e o mapeamento de fluxo em cores demonstraram insuficiência de grau ${grau}`;
    
    // Sufixo especial para Discreta
    if (status === "insuficiencia-discreta") {
      parte2 += "; sem repercussão hemodinâmica.";
    } else {
      parte2 += ".";
    }
    
    return `${parte1} ${parte2}`;
  }

  // Caso 3: Estenose
  if (status === "estenose") {
    const velocidade = velocidadeMax || "[___]";
    const gradiente = gradienteMax || "[___]";
    return `Valva ${valveName} apresenta-se com anatomia em aspecto de fusão de suas ${estrutura}. O estudo Doppler e o mapeamento de fluxo em cores demonstraram fluxo turbulento com velocidade máxima de ${velocidade} m/s e gradiente máximo de ${gradiente} mmHg.`;
  }

  // Caso 4: Displasia
  if (status === "displasia") {
    return `Valva ${valveName} apresenta-se com anatomia em aspecto displásico. O estudo Doppler e o mapeamento de fluxo em cores demonstraram insuficiência de grau importante.`;
  }

  return "";
};

export function ValvesSection({ data, onChange, onTextChange, achados }: ValvesSectionProps) {
  const handleChange = (field: keyof ValvesData, value: string | boolean) => {
    onChange({ ...data, [field]: value });
  };

  // Generate automatic text when valves change
  useEffect(() => {
    const descriptions: string[] = [];
    
    if (data.mitral) {
      descriptions.push(getValveDescription("mitral", data.mitral, !!data.mitralEspessamento, data.mitralVelocidadeMax, data.mitralGradienteMax));
    }
    if (data.tricuspide) {
      descriptions.push(getValveDescription("tricuspide", data.tricuspide, !!data.tricuspideEspessamento, data.tricuspideVelocidadeMax, data.tricuspideGradienteMax));
    }
    if (data.aortica) {
      descriptions.push(getValveDescription("aortica", data.aortica, !!data.aorticaEspessamento, data.aorticaVelocidadeMax, data.aorticaGradienteMax));
    }
    if (data.pulmonar) {
      descriptions.push(getValveDescription("pulmonar", data.pulmonar, !!data.pulmonarEspessamento, data.pulmonarVelocidadeMax, data.pulmonarGradienteMax));
    }

    if (descriptions.length > 0) {
      onTextChange(descriptions.join("\n\n"));
    }
  }, [
    data.mitral, data.mitralEspessamento, data.mitralVelocidadeMax, data.mitralGradienteMax,
    data.tricuspide, data.tricuspideEspessamento, data.tricuspideVelocidadeMax, data.tricuspideGradienteMax,
    data.aortica, data.aorticaEspessamento, data.aorticaVelocidadeMax, data.aorticaGradienteMax,
    data.pulmonar, data.pulmonarEspessamento, data.pulmonarVelocidadeMax, data.pulmonarGradienteMax
  ]);

  return (
    <div className="card-vitaecor animate-fade-in" style={{ animationDelay: '0.2s' }}>
      <h2 className="section-title">
        <Heart className="w-5 h-5 text-accent" />
        Avaliação das Valvas Cardíacas
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Mitral */}
        <div className="space-y-3">
          <Label className="label-vitaecor">Valva Mitral</Label>
          <Select value={data.mitral} onValueChange={(v) => handleChange('mitral', v)}>
            <SelectTrigger className="input-vitaecor">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50">
              {valveOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showEspessamentoCheckbox(data.mitral) && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="mitralEspessamento"
                checked={data.mitralEspessamento || false}
                onCheckedChange={(checked) => handleChange('mitralEspessamento', !!checked)}
              />
              <Label htmlFor="mitralEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Espessamento
              </Label>
            </div>
          )}
          {showEstenoseCampos(data.mitral) && (
            <div className="space-y-2 pt-1">
              <div>
                <Label className="text-xs text-muted-foreground">Velocidade Máx (m/s)</Label>
                <Input
                  className="input-vitaecor h-8 text-sm"
                  placeholder="Ex: 2.5"
                  value={data.mitralVelocidadeMax || ""}
                  onChange={(e) => handleChange('mitralVelocidadeMax', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Gradiente Máx (mmHg)</Label>
                <Input
                  className="input-vitaecor h-8 text-sm"
                  placeholder="Ex: 25"
                  value={data.mitralGradienteMax || ""}
                  onChange={(e) => handleChange('mitralGradienteMax', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Tricúspide */}
        <div className="space-y-3">
          <Label className="label-vitaecor">Valva Tricúspide</Label>
          <Select value={data.tricuspide} onValueChange={(v) => handleChange('tricuspide', v)}>
            <SelectTrigger className="input-vitaecor">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50">
              {valveOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showEspessamentoCheckbox(data.tricuspide) && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="tricuspideEspessamento"
                checked={data.tricuspideEspessamento || false}
                onCheckedChange={(checked) => handleChange('tricuspideEspessamento', !!checked)}
              />
              <Label htmlFor="tricuspideEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Espessamento
              </Label>
            </div>
          )}
          {showEstenoseCampos(data.tricuspide) && (
            <div className="space-y-2 pt-1">
              <div>
                <Label className="text-xs text-muted-foreground">Velocidade Máx (m/s)</Label>
                <Input
                  className="input-vitaecor h-8 text-sm"
                  placeholder="Ex: 2.5"
                  value={data.tricuspideVelocidadeMax || ""}
                  onChange={(e) => handleChange('tricuspideVelocidadeMax', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Gradiente Máx (mmHg)</Label>
                <Input
                  className="input-vitaecor h-8 text-sm"
                  placeholder="Ex: 25"
                  value={data.tricuspideGradienteMax || ""}
                  onChange={(e) => handleChange('tricuspideGradienteMax', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Aórtica */}
        <div className="space-y-3">
          <Label className="label-vitaecor">Valva Aórtica</Label>
          <Select value={data.aortica} onValueChange={(v) => handleChange('aortica', v)}>
            <SelectTrigger className="input-vitaecor">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50">
              {valveOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showEspessamentoCheckbox(data.aortica) && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="aorticaEspessamento"
                checked={data.aorticaEspessamento || false}
                onCheckedChange={(checked) => handleChange('aorticaEspessamento', !!checked)}
              />
              <Label htmlFor="aorticaEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Espessamento
              </Label>
            </div>
          )}
          {showEstenoseCampos(data.aortica) && (
            <div className="space-y-2 pt-1">
              <div>
                <Label className="text-xs text-muted-foreground">Velocidade Máx (m/s)</Label>
                <Input
                  className="input-vitaecor h-8 text-sm"
                  placeholder="Ex: 2.5"
                  value={data.aorticaVelocidadeMax || ""}
                  onChange={(e) => handleChange('aorticaVelocidadeMax', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Gradiente Máx (mmHg)</Label>
                <Input
                  className="input-vitaecor h-8 text-sm"
                  placeholder="Ex: 25"
                  value={data.aorticaGradienteMax || ""}
                  onChange={(e) => handleChange('aorticaGradienteMax', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Pulmonar */}
        <div className="space-y-3">
          <Label className="label-vitaecor">Valva Pulmonar</Label>
          <Select value={data.pulmonar} onValueChange={(v) => handleChange('pulmonar', v)}>
            <SelectTrigger className="input-vitaecor">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50">
              {valveOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {showEspessamentoCheckbox(data.pulmonar) && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="pulmonarEspessamento"
                checked={data.pulmonarEspessamento || false}
                onCheckedChange={(checked) => handleChange('pulmonarEspessamento', !!checked)}
              />
              <Label htmlFor="pulmonarEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Espessamento
              </Label>
            </div>
          )}
          {showEstenoseCampos(data.pulmonar) && (
            <div className="space-y-2 pt-1">
              <div>
                <Label className="text-xs text-muted-foreground">Velocidade Máx (m/s)</Label>
                <Input
                  className="input-vitaecor h-8 text-sm"
                  placeholder="Ex: 2.5"
                  value={data.pulmonarVelocidadeMax || ""}
                  onChange={(e) => handleChange('pulmonarVelocidadeMax', e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Gradiente Máx (mmHg)</Label>
                <Input
                  className="input-vitaecor h-8 text-sm"
                  placeholder="Ex: 25"
                  value={data.pulmonarGradienteMax || ""}
                  onChange={(e) => handleChange('pulmonarGradienteMax', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Texto Descritivo */}
      <div>
        <Label className="label-vitaecor">Achados Ecocardiográficos (editável)</Label>
        <Textarea
          className="input-vitaecor min-h-[150px] resize-y"
          placeholder="Selecione as valvas acima para gerar texto automático ou escreva manualmente..."
          value={achados}
          onChange={(e) => onTextChange(e.target.value)}
        />
      </div>
    </div>
  );
}
