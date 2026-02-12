import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Loader2, FileText } from "lucide-react";

const CATEGORIES = ["Normais", "Valvopatias", "Miocardiopatias", "Doenças Congênitas", "Pericárdio", "Geral"];

interface Template {
  id: string;
  title: string;
  content: string;
  category: string;
}

export function DiagnosticTemplatesSection() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Normais");
  const [showForm, setShowForm] = useState(false);

  const fetchTemplates = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("diagnostic_templates")
      .select("id, title, content, category")
      .order("category")
      .order("title");
    if (!error && data) setTemplates(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, [user]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setCategory("Normais");
    setShowForm(false);
  };

  const handleEdit = (t: Template) => {
    setEditingId(t.id);
    setTitle(t.title);
    setContent(t.content);
    setCategory(t.category);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim() || !user) return;
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("diagnostic_templates")
          .update({ title: title.trim(), content: content.trim(), category })
          .eq("id", editingId);
        if (error) throw error;
        toast({ title: "Modelo atualizado!" });
      } else {
        const { error } = await supabase
          .from("diagnostic_templates")
          .insert({
            user_id: user.id,
            clinic_id: profile?.clinic_id || null,
            title: title.trim(),
            content: content.trim(),
            category,
          });
        if (error) throw error;
        toast({ title: "Modelo criado!" });
      }
      resetForm();
      fetchTemplates();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("diagnostic_templates").delete().eq("id", id);
    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast({ title: "Modelo excluído." });
    }
  };

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = templates.filter(t => t.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<string, Template[]>);

  // Also include templates with categories not in the predefined list
  const otherTemplates = templates.filter(t => !CATEGORIES.includes(t.category));
  if (otherTemplates.length > 0) grouped["Outros"] = otherTemplates;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Modelos de Diagnóstico (Macros)
        </CardTitle>
        <CardDescription>
          Crie textos padrão para inserir rapidamente na Impressão Diagnóstica dos laudos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!showForm && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Modelo
          </Button>
        )}

        {showForm && (
          <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Título</Label>
                <Input
                  placeholder="Ex: Normal Cão"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Conteúdo do Modelo</Label>
              <Textarea
                placeholder="Digite o texto padrão do diagnóstico..."
                value={content}
                onChange={e => setContent(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={resetForm}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !title.trim() || !content.trim()}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editingId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum modelo criado. Clique em "Novo Modelo" para começar.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h4>
                <div className="space-y-1">
                  {items.map(t => (
                    <div key={t.id} className="flex items-start justify-between gap-2 p-2 rounded hover:bg-muted/50 group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{t.content}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(t)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
