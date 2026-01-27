import { Activity, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMemo, useState, useCallback, memo, useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

export interface ReferencesData {
  septoIVd: string;
  dvedDiastole: string;
  paredeLVd: string;
  dvedSistole: string;
  septoIVs: string;
  paredeLVs: string;
  fracaoEncurtamento: string;
  fracaoEjecaoTeicholz: string;
  fracaoEjecaoSimpson: string;
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
  septoIVs: string;
  paredeLVs: string;
  relacaoAEAo: string;
}

interface MeasurementsSectionProps {
  data: MeasurementsData;
  peso: string;
  especie: string; // "canino" ou "felino"
  modoMedicao: "M" | "B";
  onModoChange: (modo: "M" | "B") => void;
  onChange: (data: MeasurementsData) => void;
  classifications?: ClassificationsData;
  onClassificationsChange?: (classifications: ClassificationsData) => void;
  references?: ReferencesData;
  onReferencesChange?: (references: ReferencesData) => void;
  simpsonValue?: string;
  onSimpsonChange?: (value: string) => void;
  useAutoReferences?: boolean;
  onAutoReferencesToggle?: (enabled: boolean) => void;
  observacoesAEAo?: string;
  onObservacoesAEAoChange?: (value: string) => void;
}

type ClassificationKey = keyof ClassificationsData;
type ReferenceKey = keyof ReferencesData;

// Fórmulas Cornell 2004 para referências baseadas no peso (apenas dimensões, não índices funcionais)
const CORNELL_FORMULAS: Partial<Record<ReferenceKey, { minCoef: number; minExp: number; maxCoef: number; maxExp: number }>> = {
  septoIVd: { minCoef: 0.29, minExp: 0.241, maxCoef: 0.59, maxExp: 0.241 },
  dvedDiastole: { minCoef: 1.27, minExp: 0.294, maxCoef: 1.85, maxExp: 0.294 },
  paredeLVd: { minCoef: 0.29, minExp: 0.232, maxCoef: 0.60, maxExp: 0.232 },
  dvedSistole: { minCoef: 0.71, minExp: 0.315, maxCoef: 1.26, maxExp: 0.315 },
  septoIVs: { minCoef: 0.43, minExp: 0.240, maxCoef: 0.79, maxExp: 0.240 },
  paredeLVs: { minCoef: 0.48, minExp: 0.222, maxCoef: 0.87, maxExp: 0.222 },
  // Índices funcionais (FS, FE) não têm cálculo automático - preenchimento manual
};

// Referências ACVIM 2020 para felinos (valores de corte fixos para HCM)
const ACVIM_FELINE_REFERENCES: Partial<Record<ReferenceKey, { max: number; formatted: string }>> = {
  septoIVd: { max: 0.60, formatted: "< 0,60" },
  paredeLVd: { max: 0.60, formatted: "< 0,60" },
};

// Calcula referência Cornell baseada no peso (para caninos)
const calculateCornellReference = (peso: number, field: ReferenceKey): { min: number; max: number; formatted: string } | null => {
  if (!peso || peso <= 0 || isNaN(peso)) return null;
  
  const formula = CORNELL_FORMULAS[field];
  if (!formula) return null;
  
  const min = formula.minCoef * Math.pow(peso, formula.minExp);
  const max = formula.maxCoef * Math.pow(peso, formula.maxExp);
  
  return {
    min,
    max,
    formatted: `${min.toFixed(2).replace('.', ',')} - ${max.toFixed(2).replace('.', ',')}`,
  };
};

// Classifica valor baseado no intervalo de referência (Cornell - caninos)
const classifyValue = (value: number, min: number, max: number): string => {
  if (isNaN(value)) return "";
  if (value < min) return "diminuido";
  if (value > max) return "aumentado";
  return "normal";
};

// Classifica valor para felinos (ACVIM - apenas limite superior)
const classifyFelineValue = (value: number, max: number): string => {
  if (isNaN(value)) return "";
  if (value >= max) return "aumentado";
  return "normal";
};

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
  referenceEditable = false,
  onReferenceChange,
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
  referenceEditable?: boolean;
  onReferenceChange?: (value: string) => void;
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
      
      {referenceEditable ? (
        <Input
          className="input-vitaecor h-8 text-xs text-center"
          placeholder=""
          value={reference || ""}
          onChange={(e) => onReferenceChange?.(e.target.value)}
        />
      ) : (
        <div className="text-xs text-muted-foreground text-center">
          {reference || ""}
        </div>
      )}
      
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
  especie = "canino",
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
    septoIVs: "",
    paredeLVs: "",
    relacaoAEAo: "",
  },
  onClassificationsChange,
  references = {
    septoIVd: "",
    dvedDiastole: "",
    paredeLVd: "",
    dvedSistole: "",
    septoIVs: "",
    paredeLVs: "",
    fracaoEncurtamento: "",
    fracaoEjecaoTeicholz: "",
    fracaoEjecaoSimpson: "",
  },
  onReferencesChange,
  useAutoReferences = true,
  onAutoReferencesToggle,
  simpsonValue = "",
  onSimpsonChange,
  observacoesAEAo = "",
  onObservacoesAEAoChange,
}: MeasurementsSectionProps) {
  // Detecta se é felino para usar ACVIM ao invés de Cornell
  const isFeline = especie.toLowerCase() === "felino";
  // Handler que aceita vírgula e converte para ponto internamente
  const handleChange = useCallback((field: keyof MeasurementsData, value: string) => {
    onChange({ ...data, [field]: value });
  }, [data, onChange]);

  const handleClassificationChange = useCallback((field: ClassificationKey, value: string) => {
    if (onClassificationsChange) {
      onClassificationsChange({ ...classifications, [field]: value });
    }
  }, [classifications, onClassificationsChange]);

  const handleReferenceChange = useCallback((field: ReferenceKey, value: string) => {
    if (onReferencesChange) {
      onReferencesChange({ ...references, [field]: value });
    }
  }, [references, onReferencesChange]);

  // Referência para controlar se é a primeira renderização
  const isFirstRender = useRef(true);
  const previousPeso = useRef(peso);

  // Efeito para calcular referências automaticamente quando peso/espécie muda
  useEffect(() => {
    if (!useAutoReferences || !onReferencesChange || !onClassificationsChange) return;
    
    const pesoNum = parseDecimal(peso);
    
    // Só atualiza se o peso mudou e não é a primeira renderização
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousPeso.current = peso;
      
      // Na primeira renderização, calcula referências se tiver peso
      if (pesoNum && pesoNum > 0) {
        const newReferences = { ...references };
        
        if (isFeline) {
          // Para felinos, usa ACVIM 2020 (valores fixos)
          (Object.keys(ACVIM_FELINE_REFERENCES) as ReferenceKey[]).forEach((field) => {
            const ref = ACVIM_FELINE_REFERENCES[field];
            if (ref) {
              newReferences[field] = ref.formatted;
            }
          });
        } else {
          // Para caninos, usa Cornell 2004
          (Object.keys(CORNELL_FORMULAS) as ReferenceKey[]).forEach((field) => {
            const ref = calculateCornellReference(pesoNum, field);
            if (ref) {
              newReferences[field] = ref.formatted;
            }
          });
        }
        onReferencesChange(newReferences);
      }
      return;
    }
    
    // Se peso não mudou, não faz nada
    if (previousPeso.current === peso) return;
    previousPeso.current = peso;
    
    if (!pesoNum || pesoNum <= 0) return;
    
    // Calcula e atualiza todas as referências
    const newReferences = { ...references };
    
    if (isFeline) {
      // Para felinos, usa ACVIM 2020 (valores fixos)
      (Object.keys(ACVIM_FELINE_REFERENCES) as ReferenceKey[]).forEach((field) => {
        const ref = ACVIM_FELINE_REFERENCES[field];
        if (ref) {
          newReferences[field] = ref.formatted;
        }
      });
    } else {
      // Para caninos, usa Cornell 2004
      (Object.keys(CORNELL_FORMULAS) as ReferenceKey[]).forEach((field) => {
        const ref = calculateCornellReference(pesoNum, field);
        if (ref) {
          newReferences[field] = ref.formatted;
        }
      });
    }
    onReferencesChange(newReferences);
  }, [peso, useAutoReferences, isFeline]);

  // Efeito para classificar automaticamente valores quando medidas mudam
  useEffect(() => {
    if (!useAutoReferences || !onClassificationsChange) return;
    
    const pesoNum = parseDecimal(peso);
    if (!pesoNum || pesoNum <= 0) return;
    
    const newClassifications = { ...classifications };
    let hasChanges = false;
    
    if (isFeline) {
      // Para felinos, usa ACVIM 2020 (apenas septoIVd e paredeLVd)
      const felineFields: { dataField: keyof MeasurementsData; classField: ClassificationKey; refField: ReferenceKey }[] = [
        { dataField: 'septoIVd', classField: 'septoIVd', refField: 'septoIVd' },
        { dataField: 'paredeLVd', classField: 'paredeLVd', refField: 'paredeLVd' },
      ];
      
      felineFields.forEach(({ dataField, classField, refField }) => {
        const value = parseDecimal(data[dataField]);
        if (!value || isNaN(value)) return;
        
        const ref = ACVIM_FELINE_REFERENCES[refField];
        if (!ref) return;
        
        const classification = classifyFelineValue(value, ref.max);
        if (newClassifications[classField] !== classification) {
          newClassifications[classField] = classification;
          hasChanges = true;
        }
      });
    } else {
      // Para caninos, usa Cornell 2004
      const fieldMappings: { dataField: keyof MeasurementsData; classField: ClassificationKey; refField: ReferenceKey }[] = [
        { dataField: 'septoIVd', classField: 'septoIVd', refField: 'septoIVd' },
        { dataField: 'dvedDiastole', classField: 'dvedDiastole', refField: 'dvedDiastole' },
        { dataField: 'paredeLVd', classField: 'paredeLVd', refField: 'paredeLVd' },
        { dataField: 'dvedSistole', classField: 'dvedSistole', refField: 'dvedSistole' },
        { dataField: 'septoIVs', classField: 'septoIVs', refField: 'septoIVs' },
        { dataField: 'paredeLVs', classField: 'paredeLVs', refField: 'paredeLVs' },
      ];
      
      fieldMappings.forEach(({ dataField, classField, refField }) => {
        const value = parseDecimal(data[dataField]);
        if (!value || isNaN(value)) return;
        
        const ref = calculateCornellReference(pesoNum, refField);
        if (!ref) return;
        
        const classification = classifyValue(value, ref.min, ref.max);
        if (newClassifications[classField] !== classification) {
          newClassifications[classField] = classification;
          hasChanges = true;
        }
      });
    }
    
    if (hasChanges) {
      onClassificationsChange(newClassifications);
    }
  }, [data.septoIVd, data.dvedDiastole, data.paredeLVd, data.dvedSistole, data.septoIVs, data.paredeLVs, peso, useAutoReferences, isFeline]);

  // Cálculo do DVED Normalizado (Fórmula Alométrica)
  const dvedNormalizado = useMemo(() => {
    const pesoNum = parseDecimal(peso);
    const dvedNum = parseDecimal(data.dvedDiastole);
    
    if (!pesoNum || !dvedNum || pesoNum <= 0 || isNaN(pesoNum) || isNaN(dvedNum)) return null;
    
    const result = dvedNum / Math.pow(pesoNum, 0.294);
    return result.toFixed(2);
  }, [peso, data.dvedDiastole]);

  // Efeito para auto-classificar DVEdN quando calculado (Cornell: 1.27-1.85 = Normal)
  useEffect(() => {
    if (!onClassificationsChange || isFeline) return; // Só para caninos
    
    if (!dvedNormalizado) return;
    
    const value = parseFloat(dvedNormalizado);
    if (isNaN(value)) return;
    
    // Classificação Cornell: entre 1.27 e 1.85 é Normal, fora é Aumentado
    const newClassification = (value >= 1.27 && value <= 1.85) ? "normal" : "aumentado";
    
    if (classifications.dvedNormalizado !== newClassification) {
      onClassificationsChange({ ...classifications, dvedNormalizado: newClassification });
    }
  }, [dvedNormalizado, isFeline]);

  // Relação AE/Ao
  const relacaoAEAo = useMemo(() => {
    const ae = parseDecimal(data.atrioEsquerdo);
    const ao = parseDecimal(data.aorta);
    
    if (!ae || !ao || ao <= 0 || isNaN(ae) || isNaN(ao)) return null;
    
    return (ae / ao).toFixed(2);
  }, [data.atrioEsquerdo, data.aorta]);

  // Efeito para auto-classificar AE/Ao quando calculado (≤1.59 = Normal, >1.59 = Aumentado)
  useEffect(() => {
    if (!onClassificationsChange) return;
    
    if (!relacaoAEAo) return;
    
    const value = parseFloat(relacaoAEAo);
    if (isNaN(value)) return;
    
    const newClassification = value <= 1.59 ? "normal" : "aumentado";
    
    if (classifications.relacaoAEAo !== newClassification) {
      onClassificationsChange({ ...classifications, relacaoAEAo: newClassification });
    }
  }, [relacaoAEAo]);

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

      <div className="space-y-8">
        {/* Medidas do Ventrículo Esquerdo */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Ventrículo Esquerdo
            </h3>
            <div className="flex items-center gap-2">
              <Switch
                id="auto-ref-toggle"
                checked={useAutoReferences}
                onCheckedChange={(checked) => onAutoReferencesToggle?.(checked)}
              />
              <Label htmlFor="auto-ref-toggle" className="text-xs text-muted-foreground cursor-pointer">
                {isFeline ? "Usar Referências ACVIM 2020" : "Usar Referências Automáticas (Cornell 2004)"}
              </Label>
            </div>
          </div>
          
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
            reference={references.septoIVd}
            referenceEditable
            onReferenceChange={(val) => handleReferenceChange('septoIVd', val)}
            classificationValue={classifications.septoIVd}
            onClassificationChange={(val) => handleClassificationChange('septoIVd', val)}
          />
          
          {/* VEd com feedback visual em tempo real */}
          <div className="grid grid-cols-[1fr_100px_120px_140px] gap-3 items-center py-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Label className="label-vitaecor text-sm">Ventrículo esquerdo em diástole (VEd)</Label>
              {classifications.dvedDiastole && classifications.dvedDiastole !== "none" && (
                <Badge 
                  variant={classifications.dvedDiastole === "normal" ? "default" : "destructive"}
                  className={`text-[10px] px-1.5 py-0 ${
                    classifications.dvedDiastole === "normal" 
                      ? "bg-green-600 hover:bg-green-700" 
                      : classifications.dvedDiastole === "aumentado"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-yellow-600 hover:bg-yellow-700"
                  }`}
                >
                  {classifications.dvedDiastole === "normal" ? "Normal" : 
                   classifications.dvedDiastole === "aumentado" ? "Aumentado" : "Diminuído"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <StableDecimalInput
                className="input-vitaecor h-8 text-center"
                placeholder="0,00"
                value={data.dvedDiastole}
                onChange={(val) => handleChange('dvedDiastole', val)}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">cm</span>
            </div>
            <Input
              className="input-vitaecor h-8 text-xs text-center"
              placeholder=""
              value={references.dvedDiastole || ""}
              onChange={(e) => handleReferenceChange('dvedDiastole', e.target.value)}
            />
            <Select 
              value={classifications.dvedDiastole} 
              onValueChange={(val) => handleClassificationChange('dvedDiastole', val)}
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
          
          <MeasurementRow
            label="Parede livre do VE em diástole (PLVEd)"
            inputValue={data.paredeLVd}
            onInputChange={(val) => handleChange('paredeLVd', val)}
            unit="cm"
            reference={references.paredeLVd}
            referenceEditable
            onReferenceChange={(val) => handleReferenceChange('paredeLVd', val)}
            classificationValue={classifications.paredeLVd}
            onClassificationChange={(val) => handleClassificationChange('paredeLVd', val)}
          />
          
          <MeasurementRow
            label="Ventrículo esquerdo em sístole (VEs)"
            inputValue={data.dvedSistole}
            onInputChange={(val) => handleChange('dvedSistole', val)}
            unit="cm"
            reference={references.dvedSistole}
            referenceEditable
            onReferenceChange={(val) => handleReferenceChange('dvedSistole', val)}
            classificationValue={classifications.dvedSistole}
            onClassificationChange={(val) => handleClassificationChange('dvedSistole', val)}
          />
          
          <MeasurementRow
            label="Septo interventricular em sístole (SIVs)"
            inputValue={data.septoIVs}
            onInputChange={(val) => handleChange('septoIVs', val)}
            unit="cm"
            reference={references.septoIVs}
            referenceEditable
            onReferenceChange={(val) => handleReferenceChange('septoIVs', val)}
            classificationValue={classifications.septoIVs}
            onClassificationChange={(val) => handleClassificationChange('septoIVs', val)}
          />
          
          <MeasurementRow
            label="Parede livre do VE em sístole (PLVEs)"
            inputValue={data.paredeLVs}
            onInputChange={(val) => handleChange('paredeLVs', val)}
            unit="cm"
            reference={references.paredeLVs}
            referenceEditable
            onReferenceChange={(val) => handleReferenceChange('paredeLVs', val)}
            classificationValue={classifications.paredeLVs}
            onClassificationChange={(val) => handleClassificationChange('paredeLVs', val)}
          />
          
          {!isFeline && (
            <MeasurementRow
              label="VE em diástole NORMALIZADO (DVEdN)"
              calculatedValue={dvedNormalizado}
              reference="Ref: ≤ 1,70"
              classificationValue={classifications.dvedNormalizado}
              onClassificationChange={(val) => handleClassificationChange('dvedNormalizado', val)}
              isCalculated
              isAbnormal={isAbnormal(dvedNormalizado, 0, 1.70)}
            />
          )}
          
          <MeasurementRow
            label="Fração de Encurtamento (FS)"
            inputValue={data.fracaoEncurtamento || fracaoEncurtamento || ''}
            onInputChange={(val) => handleChange('fracaoEncurtamento', val)}
            unit="%"
            reference={references.fracaoEncurtamento || ""}
            referenceEditable
            onReferenceChange={(val) => handleReferenceChange('fracaoEncurtamento', val)}
            classificationValue={classifications.fracaoEncurtamento}
            onClassificationChange={(val) => handleClassificationChange('fracaoEncurtamento', val)}
          />
          
          <MeasurementRow
            label="Fração de Ejeção (FE Teicholz)"
            inputValue={data.fracaoEjecaoTeicholz || fracaoEjecaoTeicholz || ''}
            onInputChange={(val) => handleChange('fracaoEjecaoTeicholz', val)}
            unit="%"
            reference={references.fracaoEjecaoTeicholz || ""}
            referenceEditable
            onReferenceChange={(val) => handleReferenceChange('fracaoEjecaoTeicholz', val)}
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
            <Input
              className="input-vitaecor h-8 text-xs text-center"
              placeholder=""
              value={references.fracaoEjecaoSimpson || ""}
              onChange={(e) => handleReferenceChange('fracaoEjecaoSimpson', e.target.value)}
            />
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

        {/* Átrio Esquerdo e Aorta + Cálculos */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            ÁTRIO ESQUERDO / AORTA
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="label-vitaecor">Átrio Esquerdo (AE) - cm</Label>
              <StableDecimalInput
                className="input-vitaecor"
                placeholder="0,00"
                value={data.atrioEsquerdo}
                onChange={(val) => handleChange('atrioEsquerdo', val)}
              />
            </div>
            <div>
              <Label className="label-vitaecor">Aorta (Ao) - cm</Label>
              <StableDecimalInput
                className="input-vitaecor"
                placeholder="0,00"
                value={data.aorta}
                onChange={(val) => handleChange('aorta', val)}
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
              <div className="grid grid-cols-[1fr_80px_140px] gap-3 items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Relação AE/Ao:</span>
                <span className={`font-semibold text-center ${isAbnormal(relacaoAEAo, 0, 1.59) ? 'value-abnormal' : 'text-foreground'}`}>
                  {relacaoAEAo ? relacaoAEAo : '--'}
                </span>
                <Select 
                  value={classifications.relacaoAEAo || ""} 
                  onValueChange={(val) => handleClassificationChange('relacaoAEAo', val)}
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
          </div>
          
          {/* Observações / Outros Índices */}
          <div className="mt-4">
            <Label className="label-vitaecor">Observações / Outros Índices</Label>
            <Textarea 
              className="input-vitaecor min-h-[60px]"
              placeholder="Observações adicionais sobre AE/Ao, medidas..."
              value={observacoesAEAo}
              onChange={(e) => onObservacoesAEAoChange?.(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Legenda */}
    </div>
  );
}
