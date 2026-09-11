export type ServiceStatus =
  | "Agendado"
  | "Recebido"
  | "Em avaliação"
  | "Aguardando aprovação"
  | "Aguardando peças"
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
  "Aguardando aprovação",
  "Aguardando peças",
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
  address?: string;
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

export interface ServiceMaterialItem {
  productId: string;
  productName: string;
  quantity: number;
  /** Custo médio real da oficina por unidade. */
  unitCost: number;
  /** Acréscimo aplicado sobre o custo do material. */
  markupPercent?: number;
  /** Preço cobrado do cliente por unidade. */
  unitSalePrice?: number;
  /** Custo real consumido pela oficina. */
  costSubtotal?: number;
  /** Valor cobrado do cliente pelo material. */
  subtotal: number;
}

export interface ServiceOrder {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceDescription: string;
  /** Valor de materiais cobrado do cliente. */
  materialCost: number;
  /** Custo real dos materiais consumidos pela oficina. */
  materialRealCost?: number;
  materialItems?: ServiceMaterialItem[];
  laborCost: number;
  scheduledDate: string;
  estimatedDelivery: string;
  status: ServiceStatus;
  notes?: string;
  publicToken: string;
  completedAt?: string;
  /** Situação do pagamento do serviço. */
  paymentStatus?: "Pago" | "Não pago";
}

export interface Product {
  id: string;
  name: string;
  category?: string;
  unit?: string;
  lastUnitCost?: number;
  lastEffectiveUnitCost?: number;
  avgUnitCost?: number;
  lastPurchaseDate?: string;
  lastSupplier?: string;
  lastQuantity?: number;
  stockCurrent?: number;
  /** Acréscimo padrão sugerido ao usar o produto em um serviço. */
  defaultMarkupPercent?: number;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
  freightAllocated?: number;
  effectiveUnitCost?: number;
}

export interface PurchaseOrder {
  id: string;
  supplier: string;
  invoiceNumber?: string;
  purchaseDate: string;
  /** Campo legado de compras anteriores. */
  products?: string;
  items?: PurchaseItem[];
  subtotalAmount?: number;
  freightCost?: number;
  totalAmount: number;
  paymentMethod?: string;
  notes?: string;
}


export interface MonthlyExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  expenseDate: string;
}

export interface StoreCatalogProduct {
  id: string;
  productId: string;
  name: string;
  category?: string;
  unit?: string;
  stockCurrent: number;
  salePrice: number;
  active: boolean;
  promotionEnabled?: boolean;
  promotionPrice?: number;
  promotionLabel?: string;
  imageUrl?: string;
}


export type StoreOrderStatus = "Pendente" | "Confirmado" | "Cancelado";

export interface StoreOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  unitCost?: number;
  costSubtotal?: number;
}

export interface StoreOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  items: StoreOrderItem[];
  totalAmount: number;
  costAmount?: number;
  profitAmount?: number;
  status: StoreOrderStatus;
  orderDate: string;
  confirmedAt?: string;
  paymentMethod?: string;
  notes?: string;
  createdAt?: unknown;
}
