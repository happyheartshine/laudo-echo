import { PawPrint } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PatientData {
  nome: string;
  responsavel: string;
  especie: string;
  raca: string;
  sexo: string;
  idade: string;
  peso: string;
}

interface PatientSectionProps {
  data: PatientData;
  onChange: (data: PatientData) => void;
}

export function PatientSection({ data, onChange }: PatientSectionProps) {
  const handleChange = (field: keyof PatientData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="card-vitaecor animate-fade-in">
      <h2 className="section-title">
        <PawPrint className="w-5 h-5 text-accent" />
        Dados do Paciente
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Nome */}
        <div>
          <Label className="label-vitaecor">Nome do Paciente</Label>
          <Input
            className="input-vitaecor"
            placeholder="Ex: Rex"
            value={data.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
          />
        </div>

        {/* Responsável */}
        <div>
          <Label className="label-vitaecor">Responsável</Label>
          <Input
            className="input-vitaecor"
            placeholder="Ex: João Silva"
            value={data.responsavel}
            onChange={(e) => handleChange('responsavel', e.target.value)}
          />
        </div>

        {/* Espécie */}
        <div>
          <Label className="label-vitaecor">Espécie</Label>
          <Select value={data.especie} onValueChange={(v) => handleChange('especie', v)}>
            <SelectTrigger className="input-vitaecor">
              <SelectValue placeholder="Selecione a espécie" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50">
              <SelectItem value="canino">Canino</SelectItem>
              <SelectItem value="felino">Felino</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Raça */}
        <div>
          <Label className="label-vitaecor">Raça</Label>
          <Input
            className="input-vitaecor"
            placeholder="Ex: Golden Retriever"
            value={data.raca}
            onChange={(e) => handleChange('raca', e.target.value)}
          />
        </div>

        {/* Sexo */}
        <div>
          <Label className="label-vitaecor">Sexo</Label>
          <Select value={data.sexo} onValueChange={(v) => handleChange('sexo', v)}>
            <SelectTrigger className="input-vitaecor">
              <SelectValue placeholder="Selecione o sexo" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border z-50">
              <SelectItem value="macho">Macho</SelectItem>
              <SelectItem value="femea">Fêmea</SelectItem>
              <SelectItem value="macho-castrado">Macho Castrado</SelectItem>
              <SelectItem value="femea-castrada">Fêmea Castrada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Idade */}
        <div>
          <Label className="label-vitaecor">Idade</Label>
          <Input
            className="input-vitaecor"
            placeholder="Ex: 5 anos"
            value={data.idade}
            onChange={(e) => handleChange('idade', e.target.value)}
          />
        </div>

        {/* Peso */}
        <div>
          <Label className="label-vitaecor">Peso (kg)</Label>
          <Input
            className="input-vitaecor"
            placeholder="Ex: 12.5"
            type="number"
            step="0.1"
            min="0"
            value={data.peso}
            onChange={(e) => handleChange('peso', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
