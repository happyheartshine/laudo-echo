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
  mitralEstenose?: boolean;
  mitralDisplasia?: boolean;
  tricuspide: string;
  tricuspideEspessamento?: boolean;
  tricuspideEstenose?: boolean;
  tricuspideDisplasia?: boolean;
  aortica: string;
  aorticaEspessamento?: boolean;
  aorticaEstenose?: boolean;
  aorticaDisplasia?: boolean;
  pulmonar: string;
  pulmonarEspessamento?: boolean;
  pulmonarEstenose?: boolean;
  pulmonarDisplasia?: boolean;
}

interface ValvesSectionProps {
  data: ValvesData;
  onChange: (data: ValvesData) => void;
  onTextChange: (text: string) => void;
  achados: string;
}

// Apenas opções de fluxo/regurgitação
const valveOptions = [
  { value: "normal", label: "Normal" },
  { value: "insuficiencia-discreta", label: "Insuficiência Discreta (Leve)" },
  { value: "insuficiencia-moderada", label: "Insuficiência Moderada" },
  { value: "insuficiencia-grave", label: "Insuficiência Importante (Grave)" },
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
  hasEspessamento: boolean,
  hasEstenose: boolean,
  hasDisplasia: boolean
): string => {
  const valveNames: Record<string, string> = {
    mitral: "Valva mitral",
    tricuspide: "Valva tricúspide",
    aortica: "Valva aórtica",
    pulmonar: "Valva pulmonar",
  };

  const valveName = valveNames[valve];
  
  // Frase 1: Anatomia - baseada em espessamento e/ou displasia
  let frase1 = "";
  const anatomiaParts: string[] = [];
  
  if (hasEspessamento) {
    anatomiaParts.push("espessamento");
  }
  if (hasDisplasia) {
    anatomiaParts.push("alterações morfológicas compatíveis com displasia valvar");
  }
  
  if (anatomiaParts.length > 0) {
    if (hasEspessamento && hasDisplasia) {
      frase1 = `${valveName} apresenta espessamento de suas cúspides e alterações morfológicas compatíveis com displasia valvar, com movimentação preservada.`;
    } else if (hasEspessamento) {
      frase1 = `${valveName} apresenta espessamento e movimentação normais de suas cúspides.`;
    } else {
      frase1 = `${valveName} apresenta alterações morfológicas compatíveis com displasia valvar.`;
    }
  } else {
    frase1 = `${valveName} apresenta-se com anatomia e funcionamento dentro dos padrões de normalidade.`;
  }

  // Frase 2: Doppler/Função - baseada em insuficiência e/ou estenose
  let frase2 = "";
  const dopplerParts: string[] = [];
  
  if (isInsuficiencia(status)) {
    const grau = getGrauInsuficiencia(status);
    dopplerParts.push(`insuficiência de grau ${grau}`);
  }
  if (hasEstenose) {
    dopplerParts.push("sinais de estenose valvar");
  }
  
  if (dopplerParts.length > 0) {
    frase2 = `O estudo Doppler e o mapeamento de fluxo em cores demonstraram ${dopplerParts.join(" e ")}.`;
  }

  // Retorna frase 1 + frase 2 se houver achados Doppler
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
      descriptions.push(getValveDescription("mitral", data.mitral, !!data.mitralEspessamento, !!data.mitralEstenose, !!data.mitralDisplasia));
    }
    if (data.tricuspide) {
      descriptions.push(getValveDescription("tricuspide", data.tricuspide, !!data.tricuspideEspessamento, !!data.tricuspideEstenose, !!data.tricuspideDisplasia));
    }
    if (data.aortica) {
      descriptions.push(getValveDescription("aortica", data.aortica, !!data.aorticaEspessamento, !!data.aorticaEstenose, !!data.aorticaDisplasia));
    }
    if (data.pulmonar) {
      descriptions.push(getValveDescription("pulmonar", data.pulmonar, !!data.pulmonarEspessamento, !!data.pulmonarEstenose, !!data.pulmonarDisplasia));
    }

    if (descriptions.length > 0) {
      onTextChange(descriptions.join("\n\n"));
    }
  }, [
    data.mitral, data.mitralEspessamento, data.mitralEstenose, data.mitralDisplasia,
    data.tricuspide, data.tricuspideEspessamento, data.tricuspideEstenose, data.tricuspideDisplasia,
    data.aortica, data.aorticaEspessamento, data.aorticaEstenose, data.aorticaDisplasia,
    data.pulmonar, data.pulmonarEspessamento, data.pulmonarEstenose, data.pulmonarDisplasia
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
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mitralEspessamento"
                checked={data.mitralEspessamento || false}
                onCheckedChange={(checked) => handleChange('mitralEspessamento', !!checked)}
              />
              <Label htmlFor="mitralEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Espessamento
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mitralEstenose"
                checked={data.mitralEstenose || false}
                onCheckedChange={(checked) => handleChange('mitralEstenose', !!checked)}
              />
              <Label htmlFor="mitralEstenose" className="text-sm text-muted-foreground cursor-pointer">
                Estenose
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="mitralDisplasia"
                checked={data.mitralDisplasia || false}
                onCheckedChange={(checked) => handleChange('mitralDisplasia', !!checked)}
              />
              <Label htmlFor="mitralDisplasia" className="text-sm text-muted-foreground cursor-pointer">
                Displasia
              </Label>
            </div>
          </div>
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
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tricuspideEspessamento"
                checked={data.tricuspideEspessamento || false}
                onCheckedChange={(checked) => handleChange('tricuspideEspessamento', !!checked)}
              />
              <Label htmlFor="tricuspideEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Espessamento
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tricuspideEstenose"
                checked={data.tricuspideEstenose || false}
                onCheckedChange={(checked) => handleChange('tricuspideEstenose', !!checked)}
              />
              <Label htmlFor="tricuspideEstenose" className="text-sm text-muted-foreground cursor-pointer">
                Estenose
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="tricuspideDisplasia"
                checked={data.tricuspideDisplasia || false}
                onCheckedChange={(checked) => handleChange('tricuspideDisplasia', !!checked)}
              />
              <Label htmlFor="tricuspideDisplasia" className="text-sm text-muted-foreground cursor-pointer">
                Displasia
              </Label>
            </div>
          </div>
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
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="aorticaEspessamento"
                checked={data.aorticaEspessamento || false}
                onCheckedChange={(checked) => handleChange('aorticaEspessamento', !!checked)}
              />
              <Label htmlFor="aorticaEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Espessamento
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="aorticaEstenose"
                checked={data.aorticaEstenose || false}
                onCheckedChange={(checked) => handleChange('aorticaEstenose', !!checked)}
              />
              <Label htmlFor="aorticaEstenose" className="text-sm text-muted-foreground cursor-pointer">
                Estenose
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="aorticaDisplasia"
                checked={data.aorticaDisplasia || false}
                onCheckedChange={(checked) => handleChange('aorticaDisplasia', !!checked)}
              />
              <Label htmlFor="aorticaDisplasia" className="text-sm text-muted-foreground cursor-pointer">
                Displasia
              </Label>
            </div>
          </div>
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
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pulmonarEspessamento"
                checked={data.pulmonarEspessamento || false}
                onCheckedChange={(checked) => handleChange('pulmonarEspessamento', !!checked)}
              />
              <Label htmlFor="pulmonarEspessamento" className="text-sm text-muted-foreground cursor-pointer">
                Espessamento
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pulmonarEstenose"
                checked={data.pulmonarEstenose || false}
                onCheckedChange={(checked) => handleChange('pulmonarEstenose', !!checked)}
              />
              <Label htmlFor="pulmonarEstenose" className="text-sm text-muted-foreground cursor-pointer">
                Estenose
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="pulmonarDisplasia"
                checked={data.pulmonarDisplasia || false}
                onCheckedChange={(checked) => handleChange('pulmonarDisplasia', !!checked)}
              />
              <Label htmlFor="pulmonarDisplasia" className="text-sm text-muted-foreground cursor-pointer">
                Displasia
              </Label>
            </div>
          </div>
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
