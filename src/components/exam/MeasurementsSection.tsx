import { Activity, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemo } from "react";

interface MeasurementsData {
  dvedDiastole: string;
  dvedSistole: string;
  septoIVd: string;
  septoIVs: string;
  paredeLVd: string;
  paredeLVs: string;
  aorta: string;
  atrioEsquerdo: string;
}

interface MeasurementsSectionProps {
  data: MeasurementsData;
  peso: string;
  onChange: (data: MeasurementsData) => void;
}

export function MeasurementsSection({ data, peso, onChange }: MeasurementsSectionProps) {
  const handleChange = (field: keyof MeasurementsData, value: string) => {
    onChange({ ...data, [field]: value });
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

  // Ajustado: referência DVED Normalizado até 1.70 (era 1.27-1.85)
  const isAbnormal = (value: string | null, min: number, max: number) => {
    if (!value) return false;
    const num = parseFloat(value);
    return num < min || num > max;
  };

  return (
    <div className="card-vitaecor animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <h2 className="section-title">
        <Activity className="w-5 h-5 text-accent" />
        Medidas Ecocardiográficas (Modo M)
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Medidas do Ventrículo Esquerdo */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Ventrículo Esquerdo
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="label-vitaecor">DVED (LVIDd) - cm</Label>
              <Input
                className="input-vitaecor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={data.dvedDiastole}
                onChange={(e) => handleChange('dvedDiastole', e.target.value)}
              />
            </div>
            <div>
              <Label className="label-vitaecor">DVES (LVIDs) - cm</Label>
              <Input
                className="input-vitaecor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={data.dvedSistole}
                onChange={(e) => handleChange('dvedSistole', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="label-vitaecor">Septo IVd - cm</Label>
              <Input
                className="input-vitaecor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={data.septoIVd}
                onChange={(e) => handleChange('septoIVd', e.target.value)}
              />
            </div>
            <div>
              <Label className="label-vitaecor">Septo IVs - cm</Label>
              <Input
                className="input-vitaecor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={data.septoIVs}
                onChange={(e) => handleChange('septoIVs', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="label-vitaecor">Parede LVd - cm</Label>
              <Input
                className="input-vitaecor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={data.paredeLVd}
                onChange={(e) => handleChange('paredeLVd', e.target.value)}
              />
            </div>
            <div>
              <Label className="label-vitaecor">Parede LVs - cm</Label>
              <Input
                className="input-vitaecor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={data.paredeLVs}
                onChange={(e) => handleChange('paredeLVs', e.target.value)}
              />
            </div>
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
                <span className="text-sm text-muted-foreground">DVED Normalizado:</span>
                <span className={`font-semibold ${isAbnormal(dvedNormalizado, 0, 1.70) ? 'value-abnormal' : 'text-foreground'}`}>
                  {dvedNormalizado ? `${dvedNormalizado}` : '--'}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Relação AE/Ao:</span>
                <span className={`font-semibold ${isAbnormal(relacaoAEAo, 0, 1.6) ? 'value-abnormal' : 'text-foreground'}`}>
                  {relacaoAEAo ? relacaoAEAo : '--'}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Fração Encurt. (%):</span>
                <span className={`font-semibold ${isAbnormal(fracaoEncurtamento, 25, 45) ? 'value-abnormal' : 'text-foreground'}`}>
                  {fracaoEncurtamento ? `${fracaoEncurtamento}%` : '--'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block w-3 h-3 rounded bg-accent"></span>
        <span>Valores em vermelho indicam valores fora da normalidade (LVIDdN normal até 1,70)</span>
      </div>
    </div>
  );
}
