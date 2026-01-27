import { Heart } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";

interface ValvesData {
  mitral: string;
  mitralEspessamento?: boolean;
  tricuspide: string;
  tricuspideEspessamento?: boolean;
  aortica: string;
  aorticaEspessamento?: boolean;
  pulmonar: string;
  pulmonarEspessamento?: boolean;
}

interface ValvesSectionProps {
  data: ValvesData;
  onChange: (data: ValvesData) => void;
  onTextChange: (text: string) => void;
  achados: string;
}

const valveOptions = [
  { value: "normal", label: "Normal" },
  { value: "espessamento", label: "Espessamento" },
  { value: "insuficiencia-discreta", label: "Insuficiência Discreta" },
  { value: "insuficiencia-moderada", label: "Insuficiência Moderada" },
  { value: "insuficiencia-grave", label: "Insuficiência Grave" },
  { value: "estenose", label: "Estenose" },
  { value: "displasia", label: "Displasia" },
];

// Verifica se é uma opção de insuficiência
const isInsuficiencia = (status: string): boolean => {
  return status.startsWith("insuficiencia-");
};

// Retorna o grau da insuficiência em português
const getGrauInsuficiencia = (status: string): string => {
  const graus: Record<string, string> = {
    "insuficiencia-discreta": "discreto",
    "insuficiencia-moderada": "moderado",
    "insuficiencia-grave": "grave",
  };
  return graus[status] || "";
};

const getValveDescription = (
  valve: string,
  status: string,
  hasEspessamento: boolean
): string => {
  const valveNames: Record<string, string> = {
    mitral: "Valva mitral",
    tricuspide: "Valva tricúspide",
    aortica: "Valva aórtica",
    pulmonar: "Valva pulmonar",
  };

  const valveName = valveNames[valve];
  
  // Frase 1: Anatomia
  let frase1 = "";
  if (hasEspessamento || status === "espessamento") {
    frase1 = `${valveName} apresenta espessamento e movimentação normais de suas cúspides.`;
  } else if (status === "displasia") {
    frase1 = `${valveName} apresenta alterações morfológicas compatíveis com displasia valvar.`;
  } else {
    frase1 = `${valveName} apresenta-se com anatomia e funcionamento dentro dos padrões de normalidade.`;
  }

  // Frase 2: Doppler/Função
  let frase2 = "";
  if (isInsuficiencia(status)) {
    const grau = getGrauInsuficiencia(status);
    frase2 = `O estudo Doppler e o mapeamento de fluxo em cores demonstraram insuficiência de grau ${grau}.`;
  } else if (status === "estenose") {
    frase2 = `O estudo Doppler e o mapeamento de fluxo em cores demonstraram estenose valvar.`;
  } else if (status === "displasia" && !hasEspessamento) {
    frase2 = `O estudo Doppler e o mapeamento de fluxo em cores demonstraram sinais compatíveis com displasia valvar.`;
  }

  // Retorna apenas frase 1 para normal/espessamento puro, ou ambas para condições com alteração Doppler
  if (frase2) {
    return `${frase1} ${frase2}`;
  }
  return frase1;
};

export function ValvesSection({ data, onChange, onTextChange, achados }: ValvesSectionProps) {
  const handleChange = (field: keyof ValvesData, value: string | boolean) => {
    onChange({ ...data, [field]: value });
  };

  // Generate automatic text when valves change
  useEffect(() => {
    const descriptions: string[] = [];
    
    if (data.mitral) {
      descriptions.push(getValveDescription("mitral", data.mitral, !!data.mitralEspessamento));
    }
    if (data.tricuspide) {
      descriptions.push(getValveDescription("tricuspide", data.tricuspide, !!data.tricuspideEspessamento));
    }
    if (data.aortica) {
      descriptions.push(getValveDescription("aortica", data.aortica, !!data.aorticaEspessamento));
    }
    if (data.pulmonar) {
      descriptions.push(getValveDescription("pulmonar", data.pulmonar, !!data.pulmonarEspessamento));
    }

    if (descriptions.length > 0) {
      onTextChange(descriptions.join("\n\n"));
    }
  }, [
    data.mitral, data.mitralEspessamento,
    data.tricuspide, data.tricuspideEspessamento,
    data.aortica, data.aorticaEspessamento,
    data.pulmonar, data.pulmonarEspessamento
  ]);

  return (
    <div className="card-vitaecor animate-fade-in" style={{ animationDelay: '0.2s' }}>
      <h2 className="section-title">
        <Heart className="w-5 h-5 text-accent" />
        Avaliação das Valvas Cardíacas
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Mitral */}
        <div className="space-y-2">
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
          {isInsuficiencia(data.mitral) && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="mitralEspessamento"
                checked={data.mitralEspessamento || false}
                onCheckedChange={(checked) => handleChange('mitralEspessamento', !!checked)}
              />
              <Label htmlFor="mitralEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Há Espessamento?
              </Label>
            </div>
          )}
        </div>

        {/* Tricúspide */}
        <div className="space-y-2">
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
          {isInsuficiencia(data.tricuspide) && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="tricuspideEspessamento"
                checked={data.tricuspideEspessamento || false}
                onCheckedChange={(checked) => handleChange('tricuspideEspessamento', !!checked)}
              />
              <Label htmlFor="tricuspideEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Há Espessamento?
              </Label>
            </div>
          )}
        </div>

        {/* Aórtica */}
        <div className="space-y-2">
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
          {isInsuficiencia(data.aortica) && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="aorticaEspessamento"
                checked={data.aorticaEspessamento || false}
                onCheckedChange={(checked) => handleChange('aorticaEspessamento', !!checked)}
              />
              <Label htmlFor="aorticaEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Há Espessamento?
              </Label>
            </div>
          )}
        </div>

        {/* Pulmonar */}
        <div className="space-y-2">
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
          {isInsuficiencia(data.pulmonar) && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="pulmonarEspessamento"
                checked={data.pulmonarEspessamento || false}
                onCheckedChange={(checked) => handleChange('pulmonarEspessamento', !!checked)}
              />
              <Label htmlFor="pulmonarEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Há Espessamento?
              </Label>
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
