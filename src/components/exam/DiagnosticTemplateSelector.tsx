import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, ChevronRight } from "lucide-react";

interface Template {
  id: string;
  title: string;
  content: string;
  category: string;
}

interface DiagnosticTemplateSelectorProps {
  onSelect: (text: string) => void;
}

const CATEGORY_ORDER = ["Normais", "Valvopatias", "Miocardiopatias", "Doenças Congênitas", "Pericárdio", "Geral"];

export function DiagnosticTemplateSelector({ onSelect }: DiagnosticTemplateSelectorProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("diagnostic_templates")
        .select("id, title, content, category")
        .order("category")
        .order("title");
      if (data) setTemplates(data);
    };
    fetch();
  }, [user, open]);

  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    const items = templates.filter(t => t.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<string, Template[]>);

  // Include uncategorized
  const otherTemplates = templates.filter(t => !CATEGORY_ORDER.includes(t.category));
  if (otherTemplates.length > 0) grouped["Outros"] = otherTemplates;

  const handleSelect = (t: Template) => {
    onSelect(t.content);
    setOpen(false);
  };

  if (templates.length === 0 && !open) {
    // Still show button, templates load on open
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="default" size="sm" type="button" className="gap-2 shadow-sm">
          <FileText className="w-4 h-4" />
          Inserir Modelo
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 max-h-[350px] overflow-y-auto" align="start">
        {templates.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhum modelo criado.<br />
            Vá em Configurações → Modelos para criar.
          </div>
        ) : (
          <div className="py-1">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                  {cat}
                </div>
                {items.map(t => (
                  <button
                    key={t.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors flex items-center justify-between group"
                    onClick={() => handleSelect(t)}
                  >
                    <span className="truncate">{t.title}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
