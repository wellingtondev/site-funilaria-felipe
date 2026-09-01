export type ServiceStatus =
  | "Agendado"
  | "Recebido"
  | "Em avaliação"
  | "Em funilaria"
  | "Em preparação"
  | "Em pintura"
  | "Em acabamento"
  | "Pronto para entrega"
  | "Entregue";

export const SERVICE_STATUSES: ServiceStatus[] = [
  "Agendado",
  "Recebido",
  "Em avaliação",
  "Em funilaria",
  "Em preparação",
  "Em pintura",
  "Em acabamento",
  "Pronto para entrega",
  "Entregue",
];

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpfCnpj?: string;
}

export interface Vehicle {
  id: string;
  customerId: string;
  plate: string;
  brand: string;
  model: string;
  year?: string;
  color?: string;
}

export interface ServiceOrder {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceDescription: string;
  materialCost: number;
  laborCost: number;
  scheduledDate: string;
  estimatedDelivery: string;
  status: ServiceStatus;
  notes?: string;
  publicToken: string;
}
