import { useState, useEffect, useRef } from "react";
import { Phone, Mail, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

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
  clinicName: string; // Local do Exame / Clínica
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

// Hook para buscar clínicas usadas anteriormente (autocomplete)
function useClinicSuggestions() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchClinicNames = async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("clinic_name")
        .not("clinic_name", "is", null)
        .order("created_at", { ascending: false });
      
      if (!error && data) {
        // Remove duplicados e vazios
        const uniqueNames = [...new Set(
          data
            .map(e => e.clinic_name)
            .filter((name): name is string => !!name && name.trim() !== "")
        )];
        setSuggestions(uniqueNames);
      }
    };
    
    fetchClinicNames();
  }, []);
  
  return suggestions;
}
export function PatientSection({
  data,
  onChange
}: PatientSectionProps) {
  const clinicSuggestions = useClinicSuggestions();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleChange = (field: keyof PatientData, value: string) => {
    onChange({
      ...data,
      [field]: value
    });
  };
  
  const handlePhoneChange = (value: string) => {
    handleChange('responsavelTelefone', formatPhone(value));
  };
  
  // Handle clinic name input with autocomplete
  const handleClinicNameChange = (value: string) => {
    handleChange('clinicName', value);
    
    if (value.trim()) {
      const filtered = clinicSuggestions.filter(s => 
        s.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };
  
  const handleSelectSuggestion = (suggestion: string) => {
    handleChange('clinicName', suggestion);
    setShowSuggestions(false);
  };
  
  return <div className="card-vitaecor animate-fade-in">
      {/* Seção do Local do Exame */}
      <h2 className="section-title flex items-center gap-2">
        <MapPin className="w-5 h-5 text-accent" />
        Local do Exame
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Local do Exame / Clínica com Autocomplete */}
        <div className="relative">
          <Label className="label-vitaecor flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            Clínica / Hospital
          </Label>
          <Input 
            ref={inputRef}
            className="input-vitaecor" 
            placeholder="Ex: Hospital Veterinário XYZ" 
            value={data.clinicName || ""} 
            onChange={e => handleClinicNameChange(e.target.value)}
            onFocus={() => {
              if (data.clinicName?.trim() && filteredSuggestions.length > 0) {
                setShowSuggestions(true);
              } else if (!data.clinicName?.trim() && clinicSuggestions.length > 0) {
                setFilteredSuggestions(clinicSuggestions);
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              // Delay to allow click on suggestion
              setTimeout(() => setShowSuggestions(false), 200);
            }}
          />
          {/* Dropdown de sugestões */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {filteredSuggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground text-sm"
                  onMouseDown={() => handleSelectSuggestion(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
          {clinicSuggestions.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Sugestões baseadas em exames anteriores
            </p>
          )}
        </div>
      </div>

      {/* Divisória Visual */}
      <Separator className="my-6" />
      
      {/* Seção do Responsável/Tutor */}
      <h2 className="section-title">👤 Dados do Responsável</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Nome do Responsável */}
        <div>
          <Label className="label-vitaecor">
            Nome do Responsável <span className="text-destructive">*</span>
          </Label>
          <Input className="input-vitaecor" placeholder="Ex: João Silva" value={data.responsavel} onChange={e => handleChange('responsavel', e.target.value)} />
        </div>

        {/* Telefone/WhatsApp */}
        <div>
          <Label className="label-vitaecor flex items-center gap-1">
            <Phone className="w-3.5 h-3.5" />
            Telefone/WhatsApp
          </Label>
          <Input className="input-vitaecor" placeholder="(99) 99999-9999" value={data.responsavelTelefone} onChange={e => handlePhoneChange(e.target.value)} />
        </div>

        {/* E-mail */}
        <div>
          <Label className="label-vitaecor flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            E-mail
          </Label>
          <Input className="input-vitaecor" type="email" placeholder="exemplo@email.com" value={data.responsavelEmail} onChange={e => handleChange('responsavelEmail', e.target.value)} />
        </div>
      </div>

      {/* Divisória Visual */}
      <Separator className="my-6" />

      {/* Seção do Paciente (Animal) */}
      <h2 className="section-title">🐾 Dados do Paciente</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Nome do Paciente */}
        <div>
          <Label className="label-vitaecor">
            Nome do Paciente <span className="text-destructive">*</span>
          </Label>
          <Input className="input-vitaecor" placeholder="Ex: Rex" value={data.nome} onChange={e => handleChange('nome', e.target.value)} />
        </div>

        {/* Espécie */}
        <div>
          <Label className="label-vitaecor">
            Espécie <span className="text-destructive">*</span>
          </Label>
          <Select value={data.especie} onValueChange={v => handleChange('especie', v)}>
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
          <Input className="input-vitaecor" placeholder="Ex: Golden Retriever" value={data.raca} onChange={e => handleChange('raca', e.target.value)} />
        </div>

        {/* Sexo */}
        <div>
          <Label className="label-vitaecor">Sexo</Label>
          <Select value={data.sexo} onValueChange={v => handleChange('sexo', v)}>
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
          <Input className="input-vitaecor" placeholder="Ex: 5 anos" value={data.idade} onChange={e => handleChange('idade', e.target.value)} />
        </div>

        {/* Peso */}
        <div>
          <Label className="label-vitaecor">
            Peso (kg) <span className="text-destructive">*</span>
          </Label>
          <Input className="input-vitaecor" placeholder="Ex: 12.5" type="number" step="0.1" min="0" value={data.peso} onChange={e => handleChange('peso', e.target.value)} />
        </div>
      </div>
    </div>;
}