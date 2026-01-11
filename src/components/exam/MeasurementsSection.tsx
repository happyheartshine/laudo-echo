import { Activity, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface MeasurementsData {
  dvedDiastole: string;
  dvedSistole: string;
  septoIVd: string;
  septoIVs: string;
  paredeLVd: string;
  paredeLVs: string;
  aorta: string;
  atrioEsquerdo: string;
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
  const handleChange = (field: keyof MeasurementsData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleClassificationChange = (field: ClassificationKey, value: string) => {
    if (onClassificationsChange) {
      onClassificationsChange({ ...classifications, [field]: value });
    }
  };

  // Cálculo do DVED Normalizado (Fórmula Alométrica)
  const dvedNormalizado = useMemo(() => {
    const pesoNum = parseFloat(peso);
    const dvedNum = parseFloat(data.dvedDiastole);
    
    if (!pesoNum || !dvedNum || pesoNum <= 0) return null;
    
    const result = dvedNum / Math.pow(pesoNum, 0.294);
    return result.toFixed(2);
  }, [peso, data.dvedDiastole]);

  // Relação AE/Ao
  const relacaoAEAo = useMemo(() => {
    const ae = parseFloat(data.atrioEsquerdo);
    const ao = parseFloat(data.aorta);
    
    if (!ae || !ao || ao <= 0) return null;
    
    return (ae / ao).toFixed(2);
  }, [data.atrioEsquerdo, data.aorta]);

  // Fração de Encurtamento
  const fracaoEncurtamento = useMemo(() => {
    const dved = parseFloat(data.dvedDiastole);
    const dves = parseFloat(data.dvedSistole);
    
    if (!dved || !dves || dved <= 0) return null;
    
    const fe = ((dved - dves) / dved) * 100;
    return fe.toFixed(1);
  }, [data.dvedDiastole, data.dvedSistole]);

  // Fração de Ejeção (Teicholz)
  const fracaoEjecaoTeicholz = useMemo(() => {
    const dved = parseFloat(data.dvedDiastole);
    const dves = parseFloat(data.dvedSistole);
    
    if (!dved || !dves) return null;
    
    const vdf = (7 * Math.pow(dved, 3)) / (2.4 + dved);
    const vsf = (7 * Math.pow(dves, 3)) / (2.4 + dves);
    const fe = ((vdf - vsf) / vdf) * 100;
    return fe.toFixed(1);
  }, [data.dvedDiastole, data.dvedSistole]);

  // Ajustado: referência DVED Normalizado até 1.70 (era 1.27-1.85)
  const isAbnormal = (value: string | null, min: number, max: number) => {
    if (!value) return false;
    const num = parseFloat(value);
    return num < min || num > max;
  };

  // Componente de linha com 4 colunas
  const MeasurementRow = ({
    label,
    inputValue,
    inputField,
    unit,
    reference,
    classificationField,
    calculatedValue,
    isCalculated = false,
  }: {
    label: string;
    inputValue?: string;
    inputField?: keyof MeasurementsData;
    unit?: string;
    reference: string;
    classificationField: ClassificationKey;
    calculatedValue?: string | null;
    isCalculated?: boolean;
  }) => (
    <div className="grid grid-cols-[1fr_100px_120px_140px] gap-3 items-center py-2 border-b border-border/50">
      <Label className="label-vitaecor text-sm">{label}</Label>
      
      {isCalculated ? (
        <div className={`font-semibold text-center ${
          classificationField === 'dvedNormalizado' && isAbnormal(calculatedValue || null, 0, 1.70) 
            ? 'value-abnormal' 
            : classificationField === 'fracaoEncurtamento' && isAbnormal(calculatedValue || null, 25, 45)
            ? 'value-abnormal'
            : 'text-foreground'
        }`}>
          {calculatedValue ? `${calculatedValue}${unit || ''}` : '--'}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Input
            className="input-vitaecor h-8 text-center"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={inputValue}
            onChange={(e) => inputField && handleChange(inputField, e.target.value)}
          />
          {unit && <span className="text-xs text-muted-foreground whitespace-nowrap">{unit}</span>}
        </div>
      )}
      
      <div className="text-xs text-muted-foreground text-center">
        {reference}
      </div>
      
      <Select 
        value={classifications[classificationField]} 
        onValueChange={(val) => handleClassificationChange(classificationField, val)}
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
            inputField="septoIVd"
            unit="cm"
            reference="Ref: ..."
            classificationField="septoIVd"
          />
          
          <MeasurementRow
            label="Ventrículo esquerdo em diástole (VEd)"
            inputValue={data.dvedDiastole}
            inputField="dvedDiastole"
            unit="cm"
            reference="Ref: ..."
            classificationField="dvedDiastole"
          />
          
          <MeasurementRow
            label="Parede livre do VE em diástole (PLVEd)"
            inputValue={data.paredeLVd}
            inputField="paredeLVd"
            unit="cm"
            reference="Ref: ..."
            classificationField="paredeLVd"
          />
          
          <MeasurementRow
            label="Ventrículo esquerdo em sístole (VEs)"
            inputValue={data.dvedSistole}
            inputField="dvedSistole"
            unit="cm"
            reference="Ref: ..."
            classificationField="dvedSistole"
          />
          
          <MeasurementRow
            label="VE em diástole NORMALIZADO (DVEdN)"
            calculatedValue={dvedNormalizado}
            reference="Ref: ≤ 1,70"
            classificationField="dvedNormalizado"
            isCalculated
          />
          
          <MeasurementRow
            label="Fração de Encurtamento (FS)"
            calculatedValue={fracaoEncurtamento}
            unit="%"
            reference="Ref: 25-45%"
            classificationField="fracaoEncurtamento"
            isCalculated
          />
          
          <MeasurementRow
            label="Fração de Ejeção (FE Teicholz)"
            calculatedValue={fracaoEjecaoTeicholz}
            unit="%"
            reference="Ref: ..."
            classificationField="fracaoEjecaoTeicholz"
            isCalculated
          />
          
          {/* Fração de Ejeção Simpson - campo editável */}
          <div className="grid grid-cols-[1fr_100px_120px_140px] gap-3 items-center py-2 border-b border-border/50">
            <Label className="label-vitaecor text-sm">Fração de Ejeção (FE Simpson)</Label>
            <div className="flex items-center gap-1">
              <Input
                className="input-vitaecor h-8 text-center"
                type="number"
                step="0.1"
                placeholder="0.0"
                value={simpsonValue}
                onChange={(e) => onSimpsonChange?.(e.target.value)}
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
              <Input
                className="input-vitaecor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={data.aorta}
                onChange={(e) => handleChange('aorta', e.target.value)}
              />
            </div>
            <div>
              <Label className="label-vitaecor">Átrio Esquerdo (AE) - cm</Label>
              <Input
                className="input-vitaecor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={data.atrioEsquerdo}
                onChange={(e) => handleChange('atrioEsquerdo', e.target.value)}
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
