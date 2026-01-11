import { Activity, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMemo, useState, useCallback, memo, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDecimalForDisplay, sanitizeDecimalInput, parseDecimal } from "@/lib/decimalInput";

export interface MeasurementsData {
  dvedDiastole: string;
  dvedSistole: string;
  septoIVd: string;
  septoIVs: string;
  paredeLVd: string;
  paredeLVs: string;
  aorta: string;
  atrioEsquerdo: string;
  fracaoEncurtamento: string;
  fracaoEjecaoTeicholz: string;
}

export interface ClassificationsData {
  septoIVd: string;
  dvedDiastole: string;
  paredeLVd: string;
  dvedSistole: string;
  dvedNormalizado: string;
  fracaoEncurtamento: string;
  fracaoEjecaoTeicholz: string;
  fracaoEjecaoSimpson: string;
}

interface MeasurementsSectionProps {
  data: MeasurementsData;
  peso: string;
  modoMedicao: "M" | "B";
  onModoChange: (modo: "M" | "B") => void;
  onChange: (data: MeasurementsData) => void;
  classifications?: ClassificationsData;
  onClassificationsChange?: (classifications: ClassificationsData) => void;
  simpsonValue?: string;
  onSimpsonChange?: (value: string) => void;
}

type ClassificationKey = keyof ClassificationsData;

const CLASSIFICATION_OPTIONS = [
  { value: "", label: "Selecione" },
  { value: "normal", label: "Normal" },
  { value: "diminuido", label: "Diminuído" },
  { value: "aumentado", label: "Aumentado" },
];

// Componente de Input estável com estado local para evitar perda de foco
const StableDecimalInput = memo(function StableDecimalInput({
  value,
  onChange,
  placeholder = "0,00",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState(formatDecimalForDisplay(value));

  // Atualiza local quando valor externo muda
  useEffect(() => {
    setLocalValue(formatDecimalForDisplay(value));
  }, [value]);

  const handleChange = (e: import("react").ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeDecimalInput(e.target.value);
    setLocalValue(sanitized);
  };

  const handleBlur = () => {
    // Normaliza para ponto decimal ao perder foco
    const normalized = sanitizeDecimalInput(localValue).replace(',', '.');
    onChange(normalized);
  };

  return (
    <Input
      className={className}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
});

// Componente de linha extraído e memoizado para evitar re-renders
const MeasurementRow = memo(function MeasurementRow({
  label,
  inputValue,
  inputPlaceholder,
  onInputChange,
  unit,
  reference,
  classificationValue,
  onClassificationChange,
  calculatedValue,
  isCalculated = false,
  isAbnormal = false,
}: {
  label: string;
  inputValue?: string;
  inputPlaceholder?: string;
  onInputChange?: (value: string) => void;
  unit?: string;
  reference: string;
  classificationValue: string;
  onClassificationChange: (value: string) => void;
  calculatedValue?: string | null;
  isCalculated?: boolean;
  isAbnormal?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_100px_120px_140px] gap-3 items-center py-2 border-b border-border/50">
      <Label className="label-vitaecor text-sm">{label}</Label>
      
      {isCalculated ? (
        <div className={`font-semibold text-center ${isAbnormal ? 'value-abnormal' : 'text-foreground'}`}>
          {calculatedValue ? `${calculatedValue}${unit || ''}` : '--'}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <StableDecimalInput
            className="input-vitaecor h-8 text-center"
            placeholder={inputPlaceholder || "0,00"}
            value={inputValue || ''}
            onChange={(val) => onInputChange?.(val)}
          />
          {unit && <span className="text-xs text-muted-foreground whitespace-nowrap">{unit}</span>}
        </div>
      )}
      
      <div className="text-xs text-muted-foreground text-center">
        {reference}
      </div>
      
      <Select 
        value={classificationValue} 
        onValueChange={onClassificationChange}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Classificação" />
        </SelectTrigger>
        <SelectContent className="bg-background border shadow-lg z-50">
          {CLASSIFICATION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value || "none"}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});

export function MeasurementsSection({ 
  data, 
  peso, 
  modoMedicao, 
  onModoChange, 
  onChange,
  classifications = {
    septoIVd: "",
    dvedDiastole: "",
    paredeLVd: "",
    dvedSistole: "",
    dvedNormalizado: "",
    fracaoEncurtamento: "",
    fracaoEjecaoTeicholz: "",
    fracaoEjecaoSimpson: "",
  },
  onClassificationsChange,
  simpsonValue = "",
  onSimpsonChange,
}: MeasurementsSectionProps) {
  // Handler que aceita vírgula e converte para ponto internamente
  const handleChange = useCallback((field: keyof MeasurementsData, value: string) => {
    onChange({ ...data, [field]: value });
  }, [data, onChange]);

  const handleClassificationChange = useCallback((field: ClassificationKey, value: string) => {
    if (onClassificationsChange) {
      onClassificationsChange({ ...classifications, [field]: value });
    }
  }, [classifications, onClassificationsChange]);

  // Cálculo do DVED Normalizado (Fórmula Alométrica)
  const dvedNormalizado = useMemo(() => {
    const pesoNum = parseDecimal(peso);
    const dvedNum = parseDecimal(data.dvedDiastole);
    
    if (!pesoNum || !dvedNum || pesoNum <= 0 || isNaN(pesoNum) || isNaN(dvedNum)) return null;
    
    const result = dvedNum / Math.pow(pesoNum, 0.294);
    return result.toFixed(2);
  }, [peso, data.dvedDiastole]);

  // Relação AE/Ao
  const relacaoAEAo = useMemo(() => {
    const ae = parseDecimal(data.atrioEsquerdo);
    const ao = parseDecimal(data.aorta);
    
    if (!ae || !ao || ao <= 0 || isNaN(ae) || isNaN(ao)) return null;
    
    return (ae / ao).toFixed(2);
  }, [data.atrioEsquerdo, data.aorta]);

  // Fração de Encurtamento
  const fracaoEncurtamento = useMemo(() => {
    const dved = parseDecimal(data.dvedDiastole);
    const dves = parseDecimal(data.dvedSistole);
    
    if (!dved || !dves || dved <= 0 || isNaN(dved) || isNaN(dves)) return null;
    
    const fe = ((dved - dves) / dved) * 100;
    return fe.toFixed(1);
  }, [data.dvedDiastole, data.dvedSistole]);

  // Fração de Ejeção (Teicholz)
  const fracaoEjecaoTeicholz = useMemo(() => {
    const dved = parseDecimal(data.dvedDiastole);
    const dves = parseDecimal(data.dvedSistole);
    
    if (!dved || !dves || isNaN(dved) || isNaN(dves)) return null;
    
    const vdf = (7 * Math.pow(dved, 3)) / (2.4 + dved);
    const vsf = (7 * Math.pow(dves, 3)) / (2.4 + dves);
    const fe = ((vdf - vsf) / vdf) * 100;
    return fe.toFixed(1);
  }, [data.dvedDiastole, data.dvedSistole]);

  // Helpers para verificar valores anormais
  const isAbnormal = (value: string | null, min: number, max: number) => {
    if (!value) return false;
    const num = parseFloat(value);
    return num < min || num > max;
  };

  // Handlers com estado local para Simpson
  const [localSimpson, setLocalSimpson] = useState(formatDecimalForDisplay(simpsonValue));
  
  useEffect(() => {
    setLocalSimpson(formatDecimalForDisplay(simpsonValue));
  }, [simpsonValue]);

  const handleSimpsonChange = (e: import("react").ChangeEvent<HTMLInputElement>) => {
    setLocalSimpson(sanitizeDecimalInput(e.target.value));
  };

  const handleSimpsonBlur = () => {
    const normalized = localSimpson.replace(',', '.');
    onSimpsonChange?.(normalized);
  };

  return (
    <div className="card-vitaecor animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-title mb-0">
          <Activity className="w-5 h-5 text-accent" />
          Medidas Ecocardiográficas (Modo {modoMedicao})
        </h2>
        <RadioGroup
          value={modoMedicao}
          onValueChange={(val) => onModoChange(val as "M" | "B")}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="M" id="modo-m" />
            <Label htmlFor="modo-m" className="cursor-pointer">Modo M</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="B" id="modo-b" />
            <Label htmlFor="modo-b" className="cursor-pointer">Modo B</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Medidas do Ventrículo Esquerdo */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Ventrículo Esquerdo
          </h3>
          
          {/* Header das colunas */}
          <div className="grid grid-cols-[1fr_100px_120px_140px] gap-3 items-center pb-2 border-b border-border text-xs font-medium text-muted-foreground">
            <span>Parâmetro</span>
            <span className="text-center">Valor</span>
            <span className="text-center">Referência</span>
            <span className="text-center">Classificação</span>
          </div>
          
          <MeasurementRow
            label="Septo interventricular em diástole (SIVd)"
            inputValue={data.septoIVd}
            onInputChange={(val) => handleChange('septoIVd', val)}
            unit="cm"
            reference="Ref: ..."
            classificationValue={classifications.septoIVd}
            onClassificationChange={(val) => handleClassificationChange('septoIVd', val)}
          />
          
          <MeasurementRow
            label="Ventrículo esquerdo em diástole (VEd)"
            inputValue={data.dvedDiastole}
            onInputChange={(val) => handleChange('dvedDiastole', val)}
            unit="cm"
            reference="Ref: ..."
            classificationValue={classifications.dvedDiastole}
            onClassificationChange={(val) => handleClassificationChange('dvedDiastole', val)}
          />
          
          <MeasurementRow
            label="Parede livre do VE em diástole (PLVEd)"
            inputValue={data.paredeLVd}
            onInputChange={(val) => handleChange('paredeLVd', val)}
            unit="cm"
            reference="Ref: ..."
            classificationValue={classifications.paredeLVd}
            onClassificationChange={(val) => handleClassificationChange('paredeLVd', val)}
          />
          
          <MeasurementRow
            label="Ventrículo esquerdo em sístole (VEs)"
            inputValue={data.dvedSistole}
            onInputChange={(val) => handleChange('dvedSistole', val)}
            unit="cm"
            reference="Ref: ..."
            classificationValue={classifications.dvedSistole}
            onClassificationChange={(val) => handleClassificationChange('dvedSistole', val)}
          />
          
          <MeasurementRow
            label="VE em diástole NORMALIZADO (DVEdN)"
            calculatedValue={dvedNormalizado}
            reference="Ref: ≤ 1,70"
            classificationValue={classifications.dvedNormalizado}
            onClassificationChange={(val) => handleClassificationChange('dvedNormalizado', val)}
            isCalculated
            isAbnormal={isAbnormal(dvedNormalizado, 0, 1.70)}
          />
          
          <MeasurementRow
            label="Fração de Encurtamento (FS)"
            inputValue={data.fracaoEncurtamento || fracaoEncurtamento || ''}
            onInputChange={(val) => handleChange('fracaoEncurtamento', val)}
            unit="%"
            reference="Ref: 25-45%"
            classificationValue={classifications.fracaoEncurtamento}
            onClassificationChange={(val) => handleClassificationChange('fracaoEncurtamento', val)}
          />
          
          <MeasurementRow
            label="Fração de Ejeção (FE Teicholz)"
            inputValue={data.fracaoEjecaoTeicholz || fracaoEjecaoTeicholz || ''}
            onInputChange={(val) => handleChange('fracaoEjecaoTeicholz', val)}
            unit="%"
            reference="Ref: ..."
            classificationValue={classifications.fracaoEjecaoTeicholz}
            onClassificationChange={(val) => handleClassificationChange('fracaoEjecaoTeicholz', val)}
          />
          
          {/* Fração de Ejeção Simpson - campo editável */}
          <div className="grid grid-cols-[1fr_100px_120px_140px] gap-3 items-center py-2 border-b border-border/50">
            <Label className="label-vitaecor text-sm">Fração de Ejeção (FE Simpson)</Label>
            <div className="flex items-center gap-1">
              <Input
                className="input-vitaecor h-8 text-center"
                type="text"
                inputMode="decimal"
                placeholder="0,0"
                value={localSimpson}
                onChange={handleSimpsonChange}
                onBlur={handleSimpsonBlur}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">%</span>
            </div>
            <div className="text-xs text-muted-foreground text-center">
              Ref: ...
            </div>
            <Select 
              value={classifications.fracaoEjecaoSimpson} 
              onValueChange={(val) => handleClassificationChange('fracaoEjecaoSimpson', val)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Classificação" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {CLASSIFICATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value || "none"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Aorta e Átrio + Cálculos */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Aorta / Átrio Esquerdo
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="label-vitaecor">Aorta (Ao) - cm</Label>
              <StableDecimalInput
                className="input-vitaecor"
                placeholder="0,00"
                value={data.aorta}
                onChange={(val) => handleChange('aorta', val)}
              />
            </div>
            <div>
              <Label className="label-vitaecor">Átrio Esquerdo (AE) - cm</Label>
              <StableDecimalInput
                className="input-vitaecor"
                placeholder="0,00"
                value={data.atrioEsquerdo}
                onChange={(val) => handleChange('atrioEsquerdo', val)}
              />
            </div>
          </div>

          {/* Cálculos Automáticos */}
          <div className="mt-6 p-4 bg-secondary rounded-lg border border-border">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Cálculos Automáticos
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Relação AE/Ao:</span>
                <span className={`font-semibold ${isAbnormal(relacaoAEAo, 0, 1.6) ? 'value-abnormal' : 'text-foreground'}`}>
                  {relacaoAEAo ? relacaoAEAo : '--'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block w-3 h-3 rounded bg-accent"></span>
        <span>Valores em vermelho indicam valores fora da normalidade (DVEdN normal até 1,70)</span>
      </div>
    </div>
  );
}
