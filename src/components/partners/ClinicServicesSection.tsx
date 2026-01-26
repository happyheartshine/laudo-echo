import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Tag, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDecimalForDisplay, sanitizeDecimalInput, parseDecimal } from "@/lib/decimalInput";

interface ClinicService {
  id: string;
  partner_clinic_id: string;
  service_name: string;
  price: number;
  is_default: boolean;
}

interface ClinicServicesSectionProps {
  clinicId: string;
  onServicesChange?: () => void;
}

export function ClinicServicesSection({ clinicId, onServicesChange }: ClinicServicesSectionProps) {
  const { toast } = useToast();
  const [services, setServices] = useState<ClinicService[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ClinicService | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [servicePrice, setServicePrice] = useState("");

  useEffect(() => {
    fetchServices();
  }, [clinicId]);

  const fetchServices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clinic_services")
      .select("*")
      .eq("partner_clinic_id", clinicId)
      .order("service_name");

    if (error) {
      console.error("Error fetching clinic services:", error);
    } else {
      setServices((data || []) as ClinicService[]);
    }
    setLoading(false);
  };

  const handleOpenDialog = (service?: ClinicService) => {
    if (service) {
      setEditingService(service);
      setServiceName(service.service_name);
      setServicePrice(service.price.toString().replace('.', ','));
    } else {
      setEditingService(null);
      setServiceName("");
      setServicePrice("");
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingService(null);
    setServiceName("");
    setServicePrice("");
  };

  const handleSaveService = async () => {
    if (!serviceName.trim()) {
      toast({
        title: "Erro",
        description: "Nome do serviço é obrigatório",
        variant: "destructive",
      });
      return;
    }

    const priceValue = parseDecimal(servicePrice) || 0;

    if (editingService) {
      // Update existing service
      const { error } = await supabase
        .from("clinic_services")
        .update({
          service_name: serviceName.trim(),
          price: priceValue,
        })
        .eq("id", editingService.id);

      if (error) {
        console.error("Error updating service:", error);
        toast({
          title: "Erro",
          description: "Erro ao atualizar serviço",
          variant: "destructive",
        });
      } else {
        toast({ title: "Sucesso", description: "Serviço atualizado!" });
        handleCloseDialog();
        fetchServices();
        onServicesChange?.();
      }
    } else {
      // Create new service
      const { error } = await supabase
        .from("clinic_services")
        .insert({
          partner_clinic_id: clinicId,
          service_name: serviceName.trim(),
          price: priceValue,
        });

      if (error) {
        console.error("Error creating service:", error);
        toast({
          title: "Erro",
          description: "Erro ao criar serviço",
          variant: "destructive",
        });
      } else {
        toast({ title: "Sucesso", description: "Serviço cadastrado!" });
        handleCloseDialog();
        fetchServices();
        onServicesChange?.();
      }
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    const { error } = await supabase
      .from("clinic_services")
      .delete()
      .eq("id", serviceId);

    if (error) {
      console.error("Error deleting service:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir serviço",
        variant: "destructive",
      });
    } else {
      toast({ title: "Sucesso", description: "Serviço excluído!" });
      fetchServices();
      onServicesChange?.();
    }
  };

  // Toggle default service
  const handleToggleDefault = async (serviceId: string, currentDefault: boolean) => {
    const { error } = await supabase
      .from("clinic_services")
      .update({ is_default: !currentDefault })
      .eq("id", serviceId);

    if (error) {
      console.error("Error updating default service:", error);
      toast({
        title: "Erro",
        description: "Erro ao definir serviço padrão",
        variant: "destructive",
      });
    } else {
      toast({ 
        title: "Sucesso", 
        description: !currentDefault 
          ? "Serviço definido como padrão!" 
          : "Serviço removido como padrão" 
      });
      fetchServices();
      onServicesChange?.();
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          <h4 className="font-medium">Tabela de Preços</h4>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleOpenDialog()}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Serviço
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum serviço cadastrado. Adicione serviços como "Ecocardiograma", "Eletro", etc.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">Padrão</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <Checkbox
                      checked={service.is_default}
                      onCheckedChange={() => handleToggleDefault(service.id, service.is_default)}
                      className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                    />
                  </div>
                  {service.is_default && (
                    <Star className="w-3 h-3 text-amber-500 mx-auto mt-1" fill="currentColor" />
                  )}
                </TableCell>
                <TableCell>{service.service_name}</TableCell>
                <TableCell className="text-right">{formatCurrency(service.price)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(service)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteService(service.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add/Edit Service Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Editar Serviço" : "Adicionar Serviço"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">Nome do Serviço *</Label>
              <Input
                id="service-name"
                placeholder="Ex: Ecocardiograma"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-price">Preço (R$)</Label>
              <Input
                id="service-price"
                placeholder="Ex: 150,00"
                value={formatDecimalForDisplay(servicePrice)}
                onChange={(e) => setServicePrice(sanitizeDecimalInput(e.target.value))}
              />
            </div>
            <Button onClick={handleSaveService} className="w-full">
              {editingService ? "Salvar Alterações" : "Adicionar Serviço"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
