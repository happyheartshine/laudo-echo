import { PawPrint, User, Phone, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  responsavelTelefone: string;
  responsavelEmail: string;
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

// Função para aplicar máscara de telefone
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export function PatientSection({ data, onChange }: PatientSectionProps) {
  const handleChange = (field: keyof PatientData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handlePhoneChange = (value: string) => {
    handleChange('responsavelTelefone', formatPhone(value));
  };

  return (
    <div className="card-vitaecor animate-fade-in">
      {/* Seção do Responsável/Tutor */}
      <h2 className="section-title">
        <User className="w-5 h-5 text-accent" />
        Dados do Responsável (Tutor)
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Nome do Responsável */}
        <div>
          <Label className="label-vitaecor">
            Nome do Responsável <span className="text-destructive">*</span>
          </Label>
          <Input
            className="input-vitaecor"
            placeholder="Ex: João Silva"
            value={data.responsavel}
            onChange={(e) => handleChange('responsavel', e.target.value)}
          />
        </div>

        {/* Telefone/WhatsApp */}
        <div>
          <Label className="label-vitaecor flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" />
            Telefone/WhatsApp
          </Label>
          <Input
            className="input-vitaecor"
            placeholder="(DD) 99999-9999"
            value={data.responsavelTelefone}
            onChange={(e) => handlePhoneChange(e.target.value)}
          />
        </div>

        {/* E-mail */}
        <div>
          <Label className="label-vitaecor flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            E-mail
          </Label>
          <Input
            className="input-vitaecor"
            type="email"
            placeholder="exemplo@email.com"
            value={data.responsavelEmail}
            onChange={(e) => handleChange('responsavelEmail', e.target.value)}
          />
        </div>
      </div>

      {/* Divisória Visual */}
      <Separator className="my-6" />

      {/* Seção do Paciente (Animal) */}
      <h2 className="section-title">
        <PawPrint className="w-5 h-5 text-accent" />
        Dados do Paciente (Animal)
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Nome do Paciente */}
        <div>
          <Label className="label-vitaecor">
            Nome do Paciente <span className="text-destructive">*</span>
          </Label>
          <Input
            className="input-vitaecor"
            placeholder="Ex: Rex"
            value={data.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
          />
        </div>

        {/* Espécie */}
        <div>
          <Label className="label-vitaecor">
            Espécie <span className="text-destructive">*</span>
          </Label>
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
          <Label className="label-vitaecor">
            Peso (kg) <span className="text-destructive">*</span>
          </Label>
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
