import { Activity } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDecimalForDisplay, sanitizeDecimalInput } from "@/lib/decimalInput";

export interface RightVentricleData {
  atrioDireito: string;
  ventriculoDireito: string;
  tapse: string;
  fac: string;
  tdiS: string;
}

interface RightVentricleSectionProps {
  data: RightVentricleData;
  onChange: (data: RightVentricleData) => void;
  observacoes?: string;
  onObservacoesChange?: (value: string) => void;
}

const QUALITATIVE_OPTIONS = [
  { value: "", label: "Selecione" },
  { value: "Normal", label: "Normal" },
  { value: "Diminuído", label: "Diminuído" },
  { value: "Aumentado", label: "Aumentado" },
];

export function RightVentricleSection({ data, onChange, observacoes = "", onObservacoesChange }: RightVentricleSectionProps) {
  const handleChange = (field: keyof RightVentricleData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="card-vitaecor animate-fade-in">
      <h2 className="section-title">
        <Activity className="w-5 h-5 text-accent" />
        Ventrículo Direito
      </h2>

      <div className="space-y-6">
        {/* Avaliação Qualitativa */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Avaliação Qualitativa
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="label-vitaecor">Átrio Direito</Label>
              <Select 
                value={data.atrioDireito} 
                onValueChange={(value) => handleChange('atrioDireito', value)}
              >
                <SelectTrigger className="input-vitaecor">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {QUALITATIVE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value || "none"}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-vitaecor">Ventrículo Direito</Label>
              <Select 
                value={data.ventriculoDireito} 
                onValueChange={(value) => handleChange('ventriculoDireito', value)}
              >
                <SelectTrigger className="input-vitaecor">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {QUALITATIVE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value || "none"}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Índices de Função Sistólica do VD */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Índices de Função Sistólica do VD
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="label-vitaecor">TAPSE (cm)</Label>
              <Input 
                className="input-vitaecor" 
                type="text" 
                inputMode="decimal"
                placeholder="0,0"
                value={formatDecimalForDisplay(data.tapse)} 
                onChange={(e) => handleChange('tapse', sanitizeDecimalInput(e.target.value))} 
              />
            </div>
            <div>
              <Label className="label-vitaecor">FAC (%)</Label>
              <Input 
                className="input-vitaecor" 
                type="text" 
                inputMode="decimal"
                placeholder="0,0"
                value={formatDecimalForDisplay(data.fac)} 
                onChange={(e) => handleChange('fac', sanitizeDecimalInput(e.target.value))} 
              />
            </div>
            <div>
              <Label className="label-vitaecor">TDI: s' (cm/s)</Label>
              <Input 
                className="input-vitaecor" 
                type="text" 
                inputMode="decimal"
                placeholder="0,0"
                value={formatDecimalForDisplay(data.tdiS)} 
                onChange={(e) => handleChange('tdiS', sanitizeDecimalInput(e.target.value))} 
              />
            </div>
          </div>
        </div>
        
        {/* Observações / Outros Índices */}
        <div>
          <Label className="label-vitaecor">Observações / Outros Índices</Label>
          <Textarea 
            className="input-vitaecor min-h-[60px]"
            placeholder="Observações adicionais sobre o ventrículo direito..."
            value={observacoes}
            onChange={(e) => onObservacoesChange?.(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
