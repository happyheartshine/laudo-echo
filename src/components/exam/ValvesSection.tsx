import { Heart } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  tricuspide: string;
  aortica: string;
  pulmonar: string;
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
];

const getValveDescription = (valve: string, status: string): string => {
  const valveNames: Record<string, string> = {
    mitral: "Valva mitral",
    tricuspide: "Valva tricúspide",
    aortica: "Valva aórtica",
    pulmonar: "Valva pulmonar",
  };

  const descriptions: Record<string, string> = {
    normal: `${valveNames[valve]} apresenta-se com anatomia e funcionamento dentro dos padrões de normalidade.`,
    espessamento: `${valveNames[valve]} apresenta espessamento de folhetos, sem repercussão hemodinâmica significativa no momento do exame.`,
    "insuficiencia-discreta": `${valveNames[valve]} apresenta refluxo discreto ao estudo Doppler, classificado como insuficiência valvar de grau leve (grau I).`,
    "insuficiencia-moderada": `${valveNames[valve]} apresenta refluxo moderado ao estudo Doppler, classificado como insuficiência valvar de grau moderado (grau II).`,
    "insuficiencia-grave": `${valveNames[valve]} apresenta refluxo importante ao estudo Doppler, classificado como insuficiência valvar de grau grave (grau III). Recomenda-se acompanhamento clínico rigoroso.`,
  };

  return descriptions[status] || "";
};

export function ValvesSection({ data, onChange, onTextChange, achados }: ValvesSectionProps) {
  const handleChange = (field: keyof ValvesData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  // Generate automatic text when valves change
  useEffect(() => {
    const descriptions: string[] = [];
    
    if (data.mitral) {
      descriptions.push(getValveDescription("mitral", data.mitral));
    }
    if (data.tricuspide) {
      descriptions.push(getValveDescription("tricuspide", data.tricuspide));
    }
    if (data.aortica) {
      descriptions.push(getValveDescription("aortica", data.aortica));
    }
    if (data.pulmonar) {
      descriptions.push(getValveDescription("pulmonar", data.pulmonar));
    }

    if (descriptions.length > 0) {
      onTextChange(descriptions.join("\n\n"));
    }
  }, [data.mitral, data.tricuspide, data.aortica, data.pulmonar]);

  return (
    <div className="card-vitaecor animate-fade-in" style={{ animationDelay: '0.2s' }}>
      <h2 className="section-title">
        <Heart className="w-5 h-5 text-accent" />
        Avaliação das Valvas Cardíacas
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Mitral */}
        <div>
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
        </div>

        {/* Tricúspide */}
        <div>
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
        </div>

        {/* Aórtica */}
        <div>
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
        </div>

        {/* Pulmonar */}
        <div>
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
