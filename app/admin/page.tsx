"use client";

import { AdminButton, AdminInput, AdminSelect, AdminTextarea } from "@/components/admin/ui/AdminFields";
import { Dialog, DialogContent, Alert, LinearProgress, Paper, TableContainer, Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";
import { useAdminConfirm } from "@/components/admin/ui/useAdminConfirm";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Car,
  ClipboardList,
  Copy,
  FileDown,
  LogOut,
  Plus,
  Package,
  Pencil,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  BadgeDollarSign,
  Trash2,
  WalletCards,
  Users,
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import {
  Customer,
  Product,
  PurchaseItem,
  PurchaseOrder,
  MonthlyExpense,
  SERVICE_STATUSES,
  ServiceMaterialItem,
  ServiceOrder,
  ServiceStatus,
  StoreCatalogProduct,
  StoreOrder,
  Vehicle,
} from "@/lib/office-types";
import OfficeCalendar from "@/components/admin/OfficeCalendar";
import WorkshopSummaryPrint from "@/components/admin/WorkshopSummaryPrint";
import InternalServiceCost from "@/components/admin/InternalServiceCost";
import ServiceCostReport from "@/components/admin/ServiceCostReport";
import { buildCustomerQuoteHtml } from "@/lib/customer-quote";

type Tab = "resumo" | "clientes" | "veiculos" | "servicos" | "agenda" | "produtos" | "compras" | "vendas" | "orcamentos" | "fechamento" | "custos";

const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dateBR = (value?: string) => (value ? value.split("-").reverse().join("/") : "-");

const todayLocal = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AdminPage() {
  const router = useRouter();
  const [confirmAction,confirmationDialog] = useAdminConfirm();
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<Tab>("resumo");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [storeCatalog, setStoreCatalog] = useState<StoreCatalogProduct[]>([]);
  const [storeOrders, setStoreOrders] = useState<StoreOrder[]>([]);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [storeDrafts, setStoreDrafts] = useState<Record<string, { active: boolean; salePrice: string; promotionEnabled: boolean; promotionPrice: string; promotionLabel: string; imageUrl: string }>>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [summaryPage, setSummaryPage] = useState(1);
  const [partialPaymentOrder, setPartialPaymentOrder] = useState<ServiceOrder | null>(null);
  const [partialPaymentForm, setPartialPaymentForm] = useState({ amount: "", method: "Pix", notes: "" });
  const [paymentTargetStatus, setPaymentTargetStatus] = useState<"Pago" | "Pago parcial">("Pago parcial");
  const SUMMARY_PAGE_SIZE = 8;

  const [clientForm, setClientForm] = useState({ name: "", phone: "", email: "", cpfCnpj: "", address: "" });
  const [vehicleForm, setVehicleForm] = useState({ customerId: "", plate: "", brand: "", model: "", year: "", color: "" });
  const [orderForm, setOrderForm] = useState({
    customerId: "",
    vehicleId: "",
    serviceDescription: "",
    materialCost: "",
    laborCost: "",
    scheduledDate: "",
    estimatedDelivery: "",
    notes: "",
  });
  const [serviceMaterials, setServiceMaterials] = useState<ServiceMaterialItem[]>([]);
  const [serviceMaterialForm, setServiceMaterialForm] = useState({ productId: "", quantity: "1", markupPercent: "20" });
  const [productForm, setProductForm] = useState({ name: "", category: "", unit: "un", stockCurrent: "0", defaultMarkupPercent: "20" });
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const [purchaseForm, setPurchaseForm] = useState({
    supplier: "",
    invoiceNumber: "",
    purchaseDate: "",
    freightCost: "",
    paymentMethod: "Pix",
    notes: "",
  });
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [purchaseItemForm, setPurchaseItemForm] = useState({ productId: "", quantity: "1", unitCost: "" });
  const [quoteOrderId, setQuoteOrderId] = useState("");
  const [returnToQuote, setReturnToQuote] = useState(false);
  const [closingMonth, setClosingMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [expenseForm, setExpenseForm] = useState({ description: "", category: "Energia", amount: "", expenseDate: new Date().toISOString().slice(0, 10) });

  async function loadAll() {
    setLoading(true);
    try {
      const [cSnap, vSnap, oSnap, pSnap, productSnap, expenseSnap, storeSnap, storeOrderSnap] = await Promise.all([
        getDocs(query(collection(db, "customers"), orderBy("name"))),
        getDocs(query(collection(db, "vehicles"), orderBy("plate"))),
        getDocs(query(collection(db, "serviceOrders"), orderBy("scheduledDate", "desc"))),
        getDocs(query(collection(db, "purchaseOrders"), orderBy("purchaseDate", "desc"))),
        getDocs(query(collection(db, "products"), orderBy("name"))),
        getDocs(query(collection(db, "operatingExpenses"), orderBy("expenseDate", "desc"))),
        getDocs(collection(db, "storeCatalog")),
        getDocs(collection(db, "storeOrders")),
      ]);
      setCustomers(cSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)));
      setVehicles(vSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Vehicle)));
      setOrders(oSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ServiceOrder)));
      setPurchases(pSnap.docs.map((d) => ({ id: d.id, ...d.data() } as PurchaseOrder)));
      setProducts(productSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
      setExpenses(expenseSnap.docs.map((d) => ({ id: d.id, ...d.data() } as MonthlyExpense)));
      const catalogItems = storeSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreCatalogProduct));
      setStoreCatalog(catalogItems);
      const saleOrders = storeOrderSnap.docs.map((d) => ({ id: d.id, ...d.data() } as StoreOrder)).sort((a, b) => String(b.orderDate || "").localeCompare(String(a.orderDate || "")));
      setStoreOrders(saleOrders);
      const drafts: Record<string, { active: boolean; salePrice: string; promotionEnabled: boolean; promotionPrice: string; promotionLabel: string; imageUrl: string }> = {};
      productSnap.docs.forEach((d) => {
        const product = { id: d.id, ...d.data() } as Product;
        const catalog = catalogItems.find((item) => item.productId === product.id || item.id === product.id);
        const suggested = Number(product.avgUnitCost ?? product.lastEffectiveUnitCost ?? product.lastUnitCost ?? 0) * (1 + Number(product.defaultMarkupPercent ?? 20) / 100);
        drafts[product.id] = {
          active: Boolean(catalog?.active),
          salePrice: catalog?.salePrice ? String(catalog.salePrice) : suggested > 0 ? suggested.toFixed(2) : "",
          promotionEnabled: Boolean(catalog?.promotionEnabled),
          promotionPrice: catalog?.promotionPrice ? String(catalog.promotionPrice) : "",
          promotionLabel: catalog?.promotionLabel || "Oferta",
          imageUrl: catalog?.imageUrl || "",
        };
      });
      setStoreDrafts(drafts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (!user) router.replace("/admin/login");
        else {
          setAuthorized(true);
          loadAll();
        }
      }),
    [router]
  );

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name || "Cliente";
  const vehicleName = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.model} • ${v.plate}` : "Veículo";
  };

  const filteredVehicles = useMemo(
    () => vehicles.filter((v) => !orderForm.customerId || v.customerId === orderForm.customerId),
    [vehicles, orderForm.customerId]
  );

  const openOrders = orders.filter((o) => o.status !== "Entregue");
  const summaryTotalPages = Math.max(1, Math.ceil(orders.length / SUMMARY_PAGE_SIZE));
  const summaryOrders = orders.slice((summaryPage - 1) * SUMMARY_PAGE_SIZE, summaryPage * SUMMARY_PAGE_SIZE);
  const receivedAmount = (o: ServiceOrder) => {
    const total = Number(o.materialCost || 0) + Number(o.laborCost || 0);
    if ((o.paymentStatus || "Não pago") === "Pago") return total;
    if (o.paymentStatus === "Pago parcial") return Math.min(total, Math.max(0, Number(o.paidAmount || 0)));
    return 0;
  };
  const revenue = orders.reduce((sum, o) => sum + receivedAmount(o), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
  const lastPurchase = purchases[0];
  const purchaseSubtotal = purchaseItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const freightCost = Number(purchaseForm.freightCost || 0);
  const purchaseTotal = purchaseSubtotal + freightCost;
  const serviceMaterialCost = serviceMaterials.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const serviceMaterialRealCost = serviceMaterials.reduce((sum, item) => sum + Number(item.costSubtotal ?? (Number(item.quantity || 0) * Number(item.unitCost || 0))), 0);
  const serviceMaterialMargin = serviceMaterialCost - serviceMaterialRealCost;
  const selectedQuoteOrder = orders.find((o) => o.id === quoteOrderId);

  useEffect(() => {
    if (summaryPage > summaryTotalPages) setSummaryPage(summaryTotalPages);
  }, [summaryPage, summaryTotalPages]);

  const monthOrders = orders.filter((o) => {
    if (o.status !== "Entregue") return false;
    const referenceDate = o.completedAt || o.estimatedDelivery || o.scheduledDate;
    return Boolean(referenceDate && referenceDate.startsWith(closingMonth));
  });
  const monthPurchases = purchases.filter((p) => p.purchaseDate?.startsWith(closingMonth));
  const monthExpenses = expenses.filter((e) => e.expenseDate?.startsWith(closingMonth));
  const monthRevenue = monthOrders.reduce((sum, o) => sum + receivedAmount(o), 0);
  const monthMaterialRevenue = monthOrders.reduce((sum, o) => {
    const total = Number(o.materialCost || 0) + Number(o.laborCost || 0);
    return sum + (total > 0 ? receivedAmount(o) * (Number(o.materialCost || 0) / total) : 0);
  }, 0);
  const monthLaborRevenue = monthRevenue - monthMaterialRevenue;
  const monthPurchaseCost = monthPurchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
  const monthOperatingCost = monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const confirmedStoreOrders = storeOrders.filter((order) => order.status === "Confirmado");
  const pendingStoreOrders = storeOrders.filter((order) => order.status === "Pendente");
  const monthStoreOrders = confirmedStoreOrders.filter((order) => Boolean((order.confirmedAt || order.orderDate)?.startsWith(closingMonth)));
  const monthStoreRevenue = monthStoreOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const monthStoreCost = monthStoreOrders.reduce((sum, order) => sum + Number(order.costAmount || 0), 0);
  const monthStoreProfit = monthStoreRevenue - monthStoreCost;
  const monthTotalRevenue = monthRevenue + monthStoreRevenue;
  const monthNetProfit = monthTotalRevenue - monthPurchaseCost - monthOperatingCost;

  function resetCustomerForm() {
    setEditingCustomerId(null);
    setClientForm({ name: "", phone: "", email: "", cpfCnpj: "", address: "" });
  }

  async function addCustomer(e: FormEvent) {
    e.preventDefault();
    if (editingCustomerId) {
      await updateDoc(doc(db, "customers", editingCustomerId), { ...clientForm, updatedAt: serverTimestamp() });
      setNotice("Cliente atualizado com sucesso.");
    } else {
      await addDoc(collection(db, "customers"), { ...clientForm, createdAt: serverTimestamp() });
      setNotice("Cliente cadastrado com sucesso.");
    }
    resetCustomerForm();
    await loadAll();
  }

  function editCustomer(customer: Customer) {
    setEditingCustomerId(customer.id);
    setClientForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      cpfCnpj: customer.cpfCnpj || "",
      address: customer.address || "",
    });
    setTab("clientes");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeCustomer(customer: Customer) {
    const linkedVehicles = vehicles.filter((v) => v.customerId === customer.id);
    const linkedOrders = orders.filter((o) => o.customerId === customer.id);
    if (linkedVehicles.length || linkedOrders.length) {
      setNotice(`Não é possível excluir ${customer.name}. Existem ${linkedVehicles.length} veículo(s) e ${linkedOrders.length} serviço(s) vinculados.`);
      return;
    }
    if (!await confirmAction(`Excluir o cliente ${customer.name}? Esta ação não poderá ser desfeita.`)) return;
    await deleteDoc(doc(db, "customers", customer.id));
    if (editingCustomerId === customer.id) resetCustomerForm();
    setNotice("Cliente excluído com sucesso.");
    await loadAll();
  }

  function resetVehicleForm() {
    setEditingVehicleId(null);
    setVehicleForm({ customerId: "", plate: "", brand: "", model: "", year: "", color: "" });
  }

  async function addVehicle(e: FormEvent) {
    e.preventDefault();
    if (editingVehicleId) {
      await updateDoc(doc(db, "vehicles", editingVehicleId), { ...vehicleForm, updatedAt: serverTimestamp() });
      setNotice("Veículo atualizado com sucesso.");
    } else {
      await addDoc(collection(db, "vehicles"), { ...vehicleForm, createdAt: serverTimestamp() });
      setNotice("Veículo cadastrado com sucesso.");
    }
    resetVehicleForm();
    await loadAll();
  }

  function editVehicle(vehicle: Vehicle) {
    setEditingVehicleId(vehicle.id);
    setVehicleForm({
      customerId: vehicle.customerId || "",
      plate: vehicle.plate || "",
      brand: vehicle.brand || "",
      model: vehicle.model || "",
      year: vehicle.year || "",
      color: vehicle.color || "",
    });
    setTab("veiculos");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeVehicle(vehicle: Vehicle) {
    const linkedOrders = orders.filter((o) => o.vehicleId === vehicle.id);
    if (linkedOrders.length) {
      setNotice(`Não é possível excluir ${vehicle.brand} ${vehicle.model}. Existem ${linkedOrders.length} serviço(s) vinculados.`);
      return;
    }
    if (!await confirmAction(`Excluir o veículo ${vehicle.brand} ${vehicle.model} • ${vehicle.plate}?`)) return;
    await deleteDoc(doc(db, "vehicles", vehicle.id));
    if (editingVehicleId === vehicle.id) resetVehicleForm();
    setNotice("Veículo excluído com sucesso.");
    await loadAll();
  }

  function selectServiceMaterial(productId: string) {
    const product = products.find((p) => p.id === productId);
    setServiceMaterialForm({
      productId,
      quantity: "1",
      markupPercent: String(product?.defaultMarkupPercent ?? 20),
    });
  }

  function addServiceMaterial() {
    const product = products.find((p) => p.id === serviceMaterialForm.productId);
    const quantity = Number(serviceMaterialForm.quantity);
    if (!product || quantity <= 0) {
      setNotice("Selecione um produto e informe uma quantidade válida.");
      return;
    }

    const alreadySelected = serviceMaterials.find((item) => item.productId === product.id)?.quantity || 0;
    const allocatedQuantity = editingOrderId ? orders.find((order) => order.id === editingOrderId)?.materialItems?.find((item) => item.productId === product.id)?.quantity || 0 : 0;
    const availableStock = Number(product.stockCurrent || 0) + allocatedQuantity;
    if (alreadySelected + quantity > availableStock) {
      setNotice(`Estoque insuficiente de ${product.name}. Disponível: ${availableStock} ${product.unit || "un"}.`);
      return;
    }

    const unitCost = Number(product.avgUnitCost ?? product.lastEffectiveUnitCost ?? product.lastUnitCost ?? 0);
    if (unitCost <= 0) {
      setNotice(`O produto ${product.name} ainda não possui custo de compra. Cadastre uma compra antes de usá-lo no serviço.`);
      return;
    }

    const markupPercent = Math.max(0, Number(serviceMaterialForm.markupPercent || 0));
    const unitSalePrice = unitCost * (1 + markupPercent / 100);

    setServiceMaterials((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        const newQuantity = existing.quantity + quantity;
        return current.map((item) => item.productId === product.id
          ? {
              ...item,
              quantity: newQuantity,
              unitCost,
              markupPercent,
              unitSalePrice,
              costSubtotal: newQuantity * unitCost,
              subtotal: newQuantity * unitSalePrice,
            }
          : item);
      }
      return [...current, {
        productId: product.id,
        productName: product.name,
        quantity,
        unitCost,
        markupPercent,
        unitSalePrice,
        costSubtotal: quantity * unitCost,
        subtotal: quantity * unitSalePrice,
      }];
    });
    setServiceMaterialForm({ productId: "", quantity: "1", markupPercent: "20" });
  }

  function removeServiceMaterial(productId: string) {
    setServiceMaterials((items) => items.filter((item) => item.productId !== productId));
  }

  function resetOrderForm() {
    setReturnToQuote(false);
    setEditingOrderId(null);
    setOrderForm({
      customerId: "",
      vehicleId: "",
      serviceDescription: "",
      materialCost: "",
      laborCost: "",
      scheduledDate: "",
      estimatedDelivery: "",
      notes: "",
    });
    setServiceMaterials([]);
    setServiceMaterialForm({ productId: "", quantity: "1", markupPercent: "20" });
  }

  function editOrder(order: ServiceOrder, fromQuote = false) {
    setReturnToQuote(fromQuote);
    setEditingOrderId(order.id);
    setOrderForm({
      customerId: order.customerId || "",
      vehicleId: order.vehicleId || "",
      serviceDescription: order.serviceDescription || "",
      materialCost: String(order.materialCost || 0),
      laborCost: String(order.laborCost || 0),
      scheduledDate: order.scheduledDate || "",
      estimatedDelivery: order.estimatedDelivery || "",
      notes: order.notes || "",
    });
    setServiceMaterials(order.materialItems || []);
    setTab("servicos");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addOrder(e: FormEvent) {
    e.preventDefault();
    const existingOrder = editingOrderId ? orders.find((o) => o.id === editingOrderId) : undefined;
    const oldItems = existingOrder?.materialItems || [];

    for (const item of serviceMaterials) {
      const product = products.find((p) => p.id === item.productId);
      const oldQuantity = oldItems.find((old) => old.productId === item.productId)?.quantity || 0;
      const availableForEdit = Number(product?.stockCurrent || 0) + oldQuantity;
      if (!product || availableForEdit < item.quantity) {
        setNotice(`Estoque insuficiente para ${item.productName}. Disponível para esta ordem: ${availableForEdit} ${product?.unit || "un"}.`);
        return;
      }
    }

    const token = existingOrder?.publicToken || crypto.randomUUID().replaceAll("-", "");
    const payload = {
      ...orderForm,
      materialCost: serviceMaterialCost,
      materialRealCost: serviceMaterialRealCost,
      materialItems: serviceMaterials,
      laborCost: Number(orderForm.laborCost || 0),
      status: existingOrder?.status || ("Agendado" as ServiceStatus),
      paymentStatus: existingOrder?.paymentStatus || "Não pago",
      paidAmount: existingOrder?.paidAmount || 0,
      paymentMethod: existingOrder?.paymentMethod || "",
      paidAt: existingOrder?.paidAt || "",
      publicToken: token,
      ...(existingOrder?.completedAt ? { completedAt: existingOrder.completedAt } : {}),
    };

    const customer = customers.find((c) => c.id === payload.customerId);
    const vehicle = vehicles.find((v) => v.id === payload.vehicleId);
    const batch = writeBatch(db);
    const ref = existingOrder ? doc(db, "serviceOrders", existingOrder.id) : doc(collection(db, "serviceOrders"));

    if (existingOrder) batch.update(ref, { ...payload, updatedAt: serverTimestamp() });
    else batch.set(ref, { ...payload, createdAt: serverTimestamp() });

    batch.set(doc(db, "publicTracking", token), {
      orderId: ref.id,
      customerName: customer?.name || "Cliente",
      vehicle: vehicle ? `${vehicle.brand} ${vehicle.model}` : "Veículo",
      plate: vehicle?.plate || "",
      serviceDescription: payload.serviceDescription,
      scheduledDate: payload.scheduledDate,
      estimatedDelivery: payload.estimatedDelivery,
      status: payload.status,
      notes: payload.notes || "",
      total: payload.materialCost + payload.laborCost,
    });

    const productIds = new Set([...oldItems.map((i) => i.productId), ...serviceMaterials.map((i) => i.productId)]);
    productIds.forEach((productId) => {
      const oldQty = oldItems.find((i) => i.productId === productId)?.quantity || 0;
      const newQty = serviceMaterials.find((i) => i.productId === productId)?.quantity || 0;
      const stockDelta = oldQty - newQty;
      if (stockDelta !== 0) {
        batch.update(doc(db, "products", productId), { stockCurrent: increment(stockDelta), updatedAt: serverTimestamp() });
        batch.set(doc(db, "storeCatalog", productId), { stockCurrent: increment(stockDelta), updatedAt: serverTimestamp() }, { merge: true });
      }
    });

    await batch.commit();
    setNotice(existingOrder ? "Serviço atualizado e estoque recalculado com sucesso." : "Serviço agendado, materiais baixados do estoque e acompanhamento criado.");
    resetOrderForm();
    await loadAll();
    if (returnToQuote) { setQuoteOrderId(ref.id); setTab("orcamentos"); }
  }

  async function removeOrder(order: ServiceOrder) {
    if (!await confirmAction(`Excluir o serviço de ${customerName(order.customerId)}? Os materiais consumidos serão devolvidos ao estoque.`)) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, "serviceOrders", order.id));
    if (order.publicToken) batch.delete(doc(db, "publicTracking", order.publicToken));
    (order.materialItems || []).forEach((item) => {
      batch.update(doc(db, "products", item.productId), {
        stockCurrent: increment(Number(item.quantity || 0)),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, "storeCatalog", item.productId), {
        stockCurrent: increment(Number(item.quantity || 0)),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
    if (editingOrderId === order.id) resetOrderForm();
    setNotice("Serviço excluído e materiais devolvidos ao estoque.");
    await loadAll();
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault();
    const batch = writeBatch(db);
    const productRef = doc(collection(db, "products"));
    const stockCurrent = Number(productForm.stockCurrent || 0);
    batch.set(productRef, {
      name: productForm.name,
      category: productForm.category,
      unit: productForm.unit,
      stockCurrent,
      defaultMarkupPercent: Math.max(0, Number(productForm.defaultMarkupPercent || 0)),
      ...(editingPurchaseId ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp() }),
    }, { merge: !!editingPurchaseId });
    batch.set(doc(db, "storeCatalog", productRef.id), {
      productId: productRef.id,
      name: productForm.name,
      category: productForm.category,
      unit: productForm.unit,
      stockCurrent,
      salePrice: 0,
      active: false,
      promotionEnabled: false,
      promotionPrice: 0,
      promotionLabel: "Oferta",
      imageUrl: "",
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    setProductForm({ name: "", category: "", unit: "un", stockCurrent: "0", defaultMarkupPercent: "20" });
    setNotice("Produto cadastrado com sucesso.");
    await loadAll();
  }

  async function saveStoreProduct(product: Product) {
    const draft = storeDrafts[product.id];
    if (!draft) return;
    const salePrice = Number(draft.salePrice || 0);
    const promotionPrice = Number(draft.promotionPrice || 0);
    if (draft.active && salePrice <= 0) {
      setNotice(`Informe o preço de venda de ${product.name} antes de publicar na loja.`);
      return;
    }
    if (draft.promotionEnabled && (promotionPrice <= 0 || promotionPrice >= salePrice)) {
      setNotice(`O preço promocional de ${product.name} deve ser maior que zero e menor que o preço normal.`);
      return;
    }
    await setDoc(doc(db, "storeCatalog", product.id), {
      productId: product.id,
      name: product.name,
      category: product.category || "",
      unit: product.unit || "un",
      stockCurrent: Number(product.stockCurrent || 0),
      salePrice,
      active: draft.active,
      promotionEnabled: draft.promotionEnabled,
      promotionPrice: draft.promotionEnabled ? promotionPrice : 0,
      promotionLabel: draft.promotionLabel || "Oferta",
      imageUrl: draft.imageUrl.trim(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    setNotice(`${product.name} atualizado na loja.`);
    await loadAll();
  }

  function selectPurchaseProduct(productId: string) {
    const product = products.find((p) => p.id === productId);
    setPurchaseItemForm({
      productId,
      quantity: "1",
      unitCost: product?.lastUnitCost ? String(product.lastUnitCost) : "",
    });
  }

  function addPurchaseItem() {
    const product = products.find((p) => p.id === purchaseItemForm.productId);
    const quantity = Number(purchaseItemForm.quantity);
    const unitCost = Number(purchaseItemForm.unitCost);

    if (!product || quantity <= 0 || unitCost < 0 || !purchaseItemForm.unitCost) {
      setNotice("Selecione um produto e informe quantidade e valor unitário.");
      return;
    }

    setPurchaseItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + quantity, unitCost, subtotal: (item.quantity + quantity) * unitCost }
            : item
        );
      }
      return [...current, { productId: product.id, productName: product.name, quantity, unitCost, subtotal: quantity * unitCost }];
    });
    setPurchaseItemForm({ productId: "", quantity: "1", unitCost: "" });
  }

  function removePurchaseItem(productId: string) {
    setPurchaseItems((items) => items.filter((item) => item.productId !== productId));
  }

  function toggleProductDetails(productId: string) {
    setExpandedProducts((current) => ({
      ...current,
      [productId]: !current[productId],
    }));
  }

  function setAllProductsExpanded(expanded: boolean) {
    setExpandedProducts(
      products.reduce<Record<string, boolean>>((acc, product) => {
        acc[product.id] = expanded;
        return acc;
      }, {})
    );
  }

  function startEditPurchase(purchase: PurchaseOrder) {
    setEditingPurchaseId(purchase.id);
    setPurchaseForm({
      supplier: purchase.supplier || "",
      invoiceNumber: purchase.invoiceNumber || "",
      purchaseDate: purchase.purchaseDate || "",
      freightCost: String(Number(purchase.freightCost || 0)),
      paymentMethod: purchase.paymentMethod || "Pix",
      notes: purchase.notes || "",
    });
    setPurchaseItems((purchase.items || []).map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: Number(item.quantity || 0),
      unitCost: Number(item.unitCost || 0),
      subtotal: Number(item.quantity || 0) * Number(item.unitCost || 0),
    })));
    setPurchaseItemForm({ productId: "", quantity: "1", unitCost: "" });
    setNotice("Compra carregada para edição. Altere os dados e clique em Salvar alterações.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditPurchase() {
    setEditingPurchaseId(null);
    setPurchaseForm({ supplier: "", invoiceNumber: "", purchaseDate: "", freightCost: "", paymentMethod: "Pix", notes: "" });
    setPurchaseItems([]);
    setPurchaseItemForm({ productId: "", quantity: "1", unitCost: "" });
    setNotice("Edição da compra cancelada.");
  }

  async function addPurchase(e: FormEvent) {
    e.preventDefault();
    if (purchaseItems.length === 0) {
      setNotice("Adicione pelo menos um produto à compra.");
      return;
    }

    const allocatedItems = purchaseItems.map((item) => {
      const freightAllocated = purchaseSubtotal > 0 ? freightCost * (item.subtotal / purchaseSubtotal) : 0;
      const effectiveUnitCost = item.quantity > 0 ? (item.subtotal + freightAllocated) / item.quantity : item.unitCost;
      return { ...item, freightAllocated, effectiveUnitCost };
    });

    const batch = writeBatch(db);
    const previousPurchase = editingPurchaseId ? purchases.find((p) => p.id === editingPurchaseId) : undefined;
    const purchaseRef = editingPurchaseId ? doc(db, "purchaseOrders", editingPurchaseId) : doc(collection(db, "purchaseOrders"));
    batch.set(purchaseRef, {
      ...purchaseForm,
      freightCost,
      items: allocatedItems,
      products: allocatedItems.map((item) => `${item.productName} x${item.quantity}`).join(", "),
      subtotalAmount: purchaseSubtotal,
      totalAmount: purchaseTotal,
      createdAt: serverTimestamp(),
    });

    const affectedProductIds = new Set<string>([
      ...allocatedItems.map((item) => item.productId),
      ...(previousPurchase?.items || []).map((item) => item.productId),
    ]);

    affectedProductIds.forEach((productId) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      const oldItem = previousPurchase?.items?.find((item) => item.productId === productId);
      const newItem = allocatedItems.find((item) => item.productId === productId);
      const oldQty = Number(oldItem?.quantity || 0);
      const newQty = Number(newItem?.quantity || 0);
      const oldStock = Number(product.stockCurrent || 0);
      const newStock = Math.max(0, oldStock - oldQty + newQty);

      const currentAverage = Number(product.avgUnitCost ?? product.lastEffectiveUnitCost ?? product.lastUnitCost ?? 0);
      const oldEffective = Number(oldItem?.effectiveUnitCost ?? oldItem?.unitCost ?? 0);
      const newEffective = Number(newItem?.effectiveUnitCost ?? newItem?.unitCost ?? 0);
      const adjustedInventoryValue = Math.max(0, (oldStock * currentAverage) - (oldQty * oldEffective) + (newQty * newEffective));
      const newAverage = newStock > 0 ? adjustedInventoryValue / newStock : (newEffective || currentAverage);

      batch.update(doc(db, "products", productId), {
        ...(newItem ? {
          lastUnitCost: newItem.unitCost,
          lastEffectiveUnitCost: newItem.effectiveUnitCost,
          lastPurchaseDate: purchaseForm.purchaseDate,
          lastSupplier: purchaseForm.supplier,
          lastQuantity: newItem.quantity,
        } : {}),
        avgUnitCost: newAverage,
        stockCurrent: newStock,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, "storeCatalog", productId), {
        productId,
        name: product.name,
        category: product.category || "",
        unit: product.unit || "un",
        stockCurrent: newStock,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });

    await batch.commit();
    setPurchaseForm({
      supplier: "",
      invoiceNumber: "",
      purchaseDate: "",
      freightCost: "",
      paymentMethod: "Pix",
      notes: "",
    });
    setPurchaseItems([]);
    setPurchaseItemForm({ productId: "", quantity: "1", unitCost: "" });
    const wasEditing = !!editingPurchaseId;
    setEditingPurchaseId(null);
    setNotice(wasEditing ? "Compra atualizada. Estoque e custo médio foram ajustados pelas diferenças da edição." : "Compra cadastrada. Frete rateado, custo médio atualizado e estoque incrementado.");
    await loadAll();
  }

  async function removePurchase(id: string) {
    if (!await confirmAction("Deseja realmente excluir esta compra? O estoque dos itens desta compra será estornado.")) return;
    const purchase = purchases.find((p) => p.id === id);
    const batch = writeBatch(db);
    batch.delete(doc(db, "purchaseOrders", id));
    purchase?.items?.forEach((item) => {
      batch.update(doc(db, "products", item.productId), { stockCurrent: increment(-Number(item.quantity || 0)), updatedAt: serverTimestamp() });
      batch.set(doc(db, "storeCatalog", item.productId), { stockCurrent: increment(-Number(item.quantity || 0)), updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
    setNotice("Compra removida e estoque estornado.");
    await loadAll();
  }

  async function setProductStock(product: Product) {
    const raw = stockEdits[product.id];
    if (raw == null || raw === "" || Number(raw) < 0) {
      setNotice("Informe um estoque válido para o produto.");
      return;
    }
    const newStock = Number(raw);
    const batch = writeBatch(db);
    batch.update(doc(db, "products", product.id), { stockCurrent: newStock, updatedAt: serverTimestamp() });
    batch.set(doc(db, "storeCatalog", product.id), {
      productId: product.id,
      name: product.name,
      category: product.category || "",
      unit: product.unit || "un",
      stockCurrent: newStock,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    await batch.commit();
    setStockEdits((current) => ({ ...current, [product.id]: "" }));
    setNotice(`Estoque de ${product.name} atualizado.`);
    await loadAll();
  }

  async function confirmStoreOrder(order: StoreOrder) {
    if (order.status !== "Pendente") return;
    const unavailable = order.items.find((item) => {
      const product = products.find((p) => p.id === item.productId);
      return !product || Number(product.stockCurrent || 0) < Number(item.quantity || 0);
    });
    if (unavailable) {
      const product = products.find((p) => p.id === unavailable.productId);
      setNotice(`Estoque insuficiente para ${unavailable.productName}. Disponível: ${Number(product?.stockCurrent || 0).toLocaleString("pt-BR")}.`);
      return;
    }
    if (!await confirmAction(`Confirmar a venda de ${money(order.totalAmount)} para ${order.customerName}? O estoque será baixado agora.`)) return;

    const batch = writeBatch(db);
    let costAmount = 0;
    const itemsWithCost = order.items.map((item) => {
      const product = products.find((p) => p.id === item.productId);
      const unitCost = Number(product?.avgUnitCost ?? product?.lastEffectiveUnitCost ?? product?.lastUnitCost ?? 0);
      const costSubtotal = unitCost * Number(item.quantity || 0);
      costAmount += costSubtotal;
      batch.update(doc(db, "products", item.productId), {
        stockCurrent: increment(-Number(item.quantity || 0)),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, "storeCatalog", item.productId), {
        stockCurrent: increment(-Number(item.quantity || 0)),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return { ...item, unitCost, costSubtotal };
    });

    const confirmedAt = todayLocal();
    batch.update(doc(db, "storeOrders", order.id), {
      status: "Confirmado",
      confirmedAt,
      items: itemsWithCost,
      costAmount,
      profitAmount: Number(order.totalAmount || 0) - costAmount,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    setNotice(`Venda confirmada. Estoque baixado e ${money(order.totalAmount)} incluído no fechamento.`);
    await loadAll();
  }

  async function cancelStoreOrder(order: StoreOrder) {
    if (order.status !== "Pendente") return;
    if (!await confirmAction(`Cancelar o pedido de ${order.customerName}?`)) return;
    await updateDoc(doc(db, "storeOrders", order.id), { status: "Cancelado", updatedAt: serverTimestamp() });
    setNotice("Pedido cancelado. Nenhuma alteração foi feita no estoque.");
    await loadAll();
  }

  async function addExpense(e: FormEvent) {
    e.preventDefault();
    await addDoc(collection(db, "operatingExpenses"), {
      ...expenseForm,
      amount: Number(expenseForm.amount || 0),
      createdAt: serverTimestamp(),
    });
    setExpenseForm({ description: "", category: "Energia", amount: "", expenseDate: `${closingMonth}-01` });
    setNotice("Custo operacional cadastrado.");
    await loadAll();
  }

  async function removeExpense(id: string) {
    if (!await confirmAction("Excluir este custo do fechamento mensal?")) return;
    await deleteDoc(doc(db, "operatingExpenses", id));
    setNotice("Custo removido.");
    await loadAll();
  }

  async function updateStatus(order: ServiceOrder, status: ServiceStatus) {
    const statusUpdate = status === "Entregue"
      ? { status, completedAt: order.completedAt || new Date().toISOString().slice(0, 10) }
      : { status, completedAt: null };
    await updateDoc(doc(db, "serviceOrders", order.id), statusUpdate);
    await updateDoc(doc(db, "publicTracking", order.publicToken), { status });
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status, completedAt: status === "Entregue" ? (o.completedAt || new Date().toISOString().slice(0, 10)) : undefined } : o)));
  }


  async function updatePaymentStatus(order: ServiceOrder, paymentStatus: "Pago" | "Não pago" | "Pago parcial") {
    if (paymentStatus === "Pago parcial" || paymentStatus === "Pago") {
      const total = Number(order.materialCost || 0) + Number(order.laborCost || 0);
      const current = Number(order.paidAmount || 0);
      setPartialPaymentOrder(order);
      setPaymentTargetStatus(paymentStatus);
      setPartialPaymentForm({
        amount: paymentStatus === "Pago" ? String(total) : (current > 0 && current < total ? String(current) : ""),
        method: order.paymentMethod || "Pix",
        notes: order.paymentNotes || ""
      });
      return;
    }
    const update = { paymentStatus, paidAmount: 0, paymentMethod: "", paymentNotes: "", paidAt: "", updatedAt: serverTimestamp() };
    await updateDoc(doc(db, "serviceOrders", order.id), update);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...update } : o)));
    setNotice(`Pagamento de ${customerName(order.customerId)} atualizado para ${paymentStatus}.`);
  }

  async function savePartialPayment(generateReceipt = true) {
    if (!partialPaymentOrder) return;
    const total = Number(partialPaymentOrder.materialCost || 0) + Number(partialPaymentOrder.laborCost || 0);
    const amount = paymentTargetStatus === "Pago" ? total : Number(String(partialPaymentForm.amount).replace(",", "."));
    if (paymentTargetStatus === "Pago parcial" && (!amount || amount <= 0 || amount >= total)) {
      setNotice(`Informe um valor maior que R$ 0,00 e menor que ${money(total)} para pagamento parcial.`);
      return;
    }
    const updated = {
      paymentStatus: paymentTargetStatus,
      paidAmount: amount,
      paymentMethod: partialPaymentForm.method,
      paymentNotes: partialPaymentForm.notes.trim(),
      paidAt: todayLocal()
    };
    await updateDoc(doc(db, "serviceOrders", partialPaymentOrder.id), { ...updated, updatedAt: serverTimestamp() });
    setOrders((prev) => prev.map((o) => o.id === partialPaymentOrder.id ? { ...o, ...updated } : o));
    const receiptOrder = { ...partialPaymentOrder, ...updated };
    setPartialPaymentOrder(null);
    setNotice(paymentTargetStatus === "Pago"
      ? `Pagamento integral de ${money(total)} registrado.`
      : `Pagamento parcial de ${money(amount)} registrado. Falta ${money(total - amount)}.`);
    if (generateReceipt) generatePaymentReceipt(receiptOrder);
  }

  function generatePaymentReceipt(order: ServiceOrder) {
    const safe = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
    const total = Number(order.materialCost || 0) + Number(order.laborCost || 0);
    const paid = order.paymentStatus === "Pago" ? total : Number(order.paidAmount || 0);
    const remaining = Math.max(0, total - paid);
    const receiptWindow = window.open("", "_blank", "width=850,height=950");
    if (!receiptWindow) { setNotice("O navegador bloqueou a janela do recibo. Libere pop-ups e tente novamente."); return; }
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Recibo - ${safe(customerName(order.customerId))}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;background:#eee;margin:0;color:#171717}.page{width:210mm;min-height:297mm;margin:auto;background:#fff;padding:18mm}.head{background:#080808;color:#fff;padding:18px 22px;border-bottom:5px solid #c99523}.brand{font-size:25px;font-weight:900;letter-spacing:5px}.sub{color:#d7a52d;letter-spacing:4px;font-size:10px;margin-top:4px}.title{margin:28px 0 18px;text-align:center}.title h1{margin:0;font-size:25px}.title p{color:#666}.box{border:1px solid #ddd;border-radius:10px;padding:14px;margin:10px 0}.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.label{font-size:10px;text-transform:uppercase;color:#777;display:block;margin-bottom:4px}.value{font-weight:700}.amount{margin:20px 0;border:2px solid #c99523;border-radius:12px;padding:18px}.amount div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.amount div:last-child{border:0}.paid{font-size:20px;color:#15783a}.remaining{font-size:18px;color:#a33}.footer{margin-top:55px;text-align:center;color:#666;font-size:11px}.sign{margin:70px auto 0;width:65%;border-top:1px solid #333;padding-top:7px;text-align:center}@page{size:A4;margin:0}@media print{body{background:#fff}.page{margin:0;min-height:297mm}button{display:none}}</style></head><body><div class="page"><div class="head"><div class="brand">FELIPE</div><div class="sub">AUTO DESIGN</div></div><div class="title"><h1>RECIBO DE PAGAMENTO</h1><p>Comprovante de pagamento ${order.paymentStatus === "Pago parcial" ? "parcial" : "do serviço"}</p></div><div class="row"><div class="box"><span class="label">Cliente</span><span class="value">${safe(customerName(order.customerId))}</span></div><div class="box"><span class="label">Veículo</span><span class="value">${safe(vehicleName(order.vehicleId))}</span></div></div><div class="box"><span class="label">Serviço</span><span class="value">${safe(order.serviceDescription)}</span></div><div class="row"><div class="box"><span class="label">Data do pagamento</span><span class="value">${safe(dateBR(order.paidAt || todayLocal()))}</span></div><div class="box"><span class="label">Forma de pagamento</span><span class="value">${safe(order.paymentMethod || "Não informada")}</span></div></div><div class="amount"><div><span>Valor total do serviço</span><b>${money(total)}</b></div><div class="paid"><span>Valor recebido</span><b>${money(paid)}</b></div><div class="remaining"><span>Valor restante</span><b>${money(remaining)}</b></div></div>${order.paymentNotes ? `<div class="box"><span class="label">Observações do pagamento</span><span class="value">${safe(order.paymentNotes)}</span></div>` : ""}<div class="box"><span class="label">Declaração</span>Recebemos de <b>${safe(customerName(order.customerId))}</b> a quantia de <b>${money(paid)}</b>, referente ao serviço descrito neste recibo. Saldo restante: <b>${money(remaining)}</b>.</div><div class="sign">Felipe Auto Design</div><div class="footer">Avenida Alfredo de Faria, 87 - Tutunas • WhatsApp (34) 99154-3776<br/>Documento gerado pelo sistema de gestão da oficina.</div></div><script>window.onload=()=>setTimeout(()=>window.print(),300);</script></body></html>`;
    receiptWindow.document.open(); receiptWindow.document.write(html); receiptWindow.document.close();
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/acompanhar/${token}`;
    navigator.clipboard.writeText(url);
    setNotice("Link copiado. Envie para o cliente pelo WhatsApp.");
  }

  function generateQuotePdf() {
    if (!selectedQuoteOrder) return;
    const customer = customers.find((item) => item.id === selectedQuoteOrder.customerId);
    const vehicle = vehicles.find((item) => item.id === selectedQuoteOrder.vehicleId);
    const quoteWindow = window.open("", "_blank", "width=900,height=1100");
    if (!quoteWindow) {
      setNotice("O navegador bloqueou a janela do orçamento. Libere pop-ups e tente novamente.");
      return;
    }
    quoteWindow.document.open();
    quoteWindow.document.write(buildCustomerQuoteHtml(selectedQuoteOrder, customer, vehicle));
    quoteWindow.document.close();
  }

  if (!authorized) return <main className="admin-loading">Carregando área da oficina...</main>;

  return (
    <main className="admin-page">
      <section className="admin-hero container">
        <div>
          <span className="eyebrow">FELIPE AUTO DESIGN / GESTÃO DA OFICINA</span>
          <h1>Seu negócio, em visão completa.</h1>
          <p>Felipe Auto Design • Operação, clientes e resultados em um só lugar.</p>
        </div>
        <div className="admin-actions"><a className="admin-site-link" href="/">Ver site ↗</a>
          <AdminButton onClick={loadAll}><RefreshCw size={17} /> Atualizar</AdminButton>
          <AdminButton onClick={() => signOut(auth)}><LogOut size={17} /> Sair</AdminButton>
        </div>
      </section>

      <section className="container admin-shell">
        {notice && <Alert severity="info" onClose={() => setNotice("")} sx={{mb:3}}>{notice}</Alert>}

        <div className="admin-workspace">
        <nav className="admin-tabs" aria-label="Navegação do painel">
          <AdminButton className={tab === "resumo" ? "active" : ""} onClick={() => setTab("resumo")}><ClipboardList size={17} />Resumo</AdminButton>
          <AdminButton className={tab === "clientes" ? "active" : ""} onClick={() => setTab("clientes")}><Users size={17} />Clientes</AdminButton>
          <AdminButton className={tab === "veiculos" ? "active" : ""} onClick={() => setTab("veiculos")}><Car size={17} />Veículos</AdminButton>
          <AdminButton className={tab === "servicos" ? "active" : ""} onClick={() => setTab("servicos")}><Plus size={17} />Serviços</AdminButton>
          <AdminButton className={tab === "produtos" ? "active" : ""} onClick={() => setTab("produtos")}><Package size={17} />Produtos</AdminButton>
          <AdminButton className={tab === "compras" ? "active" : ""} onClick={() => setTab("compras")}><ShoppingCart size={17} />Compras</AdminButton>
          <AdminButton className={tab === "vendas" ? "active" : ""} onClick={() => setTab("vendas")}><BadgeDollarSign size={17} />Vendas{pendingStoreOrders.length > 0 ? ` (${pendingStoreOrders.length})` : ""}</AdminButton>
          <AdminButton className={tab === "orcamentos" ? "active" : ""} onClick={() => setTab("orcamentos")}><ReceiptText size={17} />Orçamentos</AdminButton>
          <AdminButton className={tab === "fechamento" ? "active" : ""} onClick={() => setTab("fechamento")}><WalletCards size={17} />Fechamento</AdminButton>
          <AdminButton className={tab === "custos" ? "active" : ""} onClick={() => setTab("custos")}><BadgeDollarSign size={17} />Custos dos serviços</AdminButton>
          <AdminButton className={tab === "agenda" ? "active" : ""} onClick={() => setTab("agenda")}><CalendarDays size={17} />Agenda</AdminButton>
        </nav>

        <div className="admin-content">
        {loading ? <div className="admin-loading"><LinearProgress/><p>Carregando dados...</p></div> : <>
          {tab === "resumo" && <div>
            <WorkshopSummaryPrint orders={orders} products={products} customers={customers} vehicles={vehicles} />
            <div className="admin-kpis admin-kpis-five">
              <Paper component="article" elevation={0}><span>Clientes</span><strong>{customers.length}</strong></Paper>
              <Paper component="article" elevation={0}><span>Veículos</span><strong>{vehicles.length}</strong></Paper>
              <Paper component="article" elevation={0}><span>Serviços em andamento</span><strong>{openOrders.length}</strong></Paper>
              <Paper component="article" elevation={0}><span>Valor dos serviços pagos</span><strong>{money(revenue)}</strong></Paper>
              <Paper component="article" elevation={0}><span>Última compra</span><strong>{lastPurchase ? money(lastPurchase.totalAmount) : "-"}</strong><small>{lastPurchase ? dateBR(lastPurchase.purchaseDate) : "Sem compras"}</small></Paper>
            </div>
            <div className="summary-services-head">
              <div>
                <h2 className="admin-section-title">Serviços recentes</h2>
                <span className="summary-record-count">{orders.length} serviço(s) cadastrado(s)</span>
              </div>
              {orders.length > 0 && <span className="summary-page-info">Página {summaryPage} de {summaryTotalPages}</span>}
            </div>
            <OrderTable orders={summaryOrders} customerName={customerName} vehicleName={vehicleName} onStatus={updateStatus} onPayment={updatePaymentStatus} onReceipt={generatePaymentReceipt} onCopy={copyLink} onEdit={editOrder} onDelete={removeOrder} />
            {summaryTotalPages > 1 && <div className="summary-pagination" aria-label="Paginação dos serviços">
              <AdminButton type="button" className="admin-secondary" disabled={summaryPage === 1} onClick={() => setSummaryPage((page) => Math.max(1, page - 1))}><ChevronUp size={16} className="pagination-left" /> Anterior</AdminButton>
              <div className="summary-page-numbers">
                {Array.from({ length: summaryTotalPages }, (_, index) => index + 1).map((page) => <AdminButton type="button" key={page} className={page === summaryPage ? "active" : ""} onClick={() => setSummaryPage(page)} aria-label={`Ir para página ${page}`}>{page}</AdminButton>)}
              </div>
              <AdminButton type="button" className="admin-secondary" disabled={summaryPage === summaryTotalPages} onClick={() => setSummaryPage((page) => Math.min(summaryTotalPages, page + 1))}>Próxima <ChevronDown size={16} className="pagination-right" /></AdminButton>
            </div>}
          </div>}

          {tab === "clientes" && <div className="admin-two-cols">
            <Paper component="form" elevation={0} className="admin-card admin-form" onSubmit={addCustomer}>
              <h2>{editingCustomerId ? "Editar cliente" : "Novo cliente"}</h2>
              <div className="admin-field-group"><AdminInput label={<>Nome</>} value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} required /></div>
              <div className="admin-field-group"><AdminInput label={<>WhatsApp</>} mask="phone" value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} required /></div>
              <div className="admin-field-group"><AdminInput label={<>E-mail</>} type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} /></div>
              <div className="admin-field-group"><AdminInput label={<>CPF/CNPJ</>} mask="document" value={clientForm.cpfCnpj} onChange={(e) => setClientForm({ ...clientForm, cpfCnpj: e.target.value })} /></div>
              <div className="admin-field-group"><AdminInput label={<>Endereço</>} value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} /></div>
              <div className="form-action-row"><AdminButton className="admin-primary">{editingCustomerId ? "Salvar alterações" : "Cadastrar cliente"}</AdminButton>{editingCustomerId && <AdminButton type="button" className="admin-secondary" onClick={resetCustomerForm}>Cancelar</AdminButton>}</div>
            </Paper>
            <Paper component="div" elevation={0} className="admin-card"><h2>Clientes cadastrados</h2><div className="admin-list">{customers.map((c) => <Paper component="article" elevation={0} key={c.id}><div className="entity-list-row"><div><b>{c.name}</b><span>{c.phone}</span><small>{c.email || c.cpfCnpj || c.address || "Sem dados adicionais"}</small></div><div className="entity-actions"><AdminButton type="button" className="edit-icon" onClick={() => editCustomer(c)} title="Editar cliente"><Pencil size={15} /></AdminButton><AdminButton type="button" className="danger-icon" onClick={() => removeCustomer(c)} title="Excluir cliente"><Trash2 size={15} /></AdminButton></div></div></Paper>)}</div></Paper>
          </div>}

          {tab === "veiculos" && <div className="admin-two-cols">
            <Paper component="form" elevation={0} className="admin-card admin-form" onSubmit={addVehicle}>
              <h2>{editingVehicleId ? "Editar veículo" : "Novo veículo"}</h2>
              <div className="admin-field-group"><AdminSelect label={<>Cliente</>} value={vehicleForm.customerId} onChange={(e) => setVehicleForm({ ...vehicleForm, customerId: e.target.value })} required><option value="">Selecione</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</AdminSelect></div>
              <div className="admin-form-row"><div className="admin-field-group"><AdminInput label={<>Placa</>} mask="plate" value={vehicleForm.plate} onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })} required /></div><div className="admin-field-group"><AdminInput label={<>Ano</>} mask="year" value={vehicleForm.year} onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })} /></div></div>
              <div className="admin-form-row"><div className="admin-field-group"><AdminInput label={<>Marca</>} value={vehicleForm.brand} onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })} required /></div><div className="admin-field-group"><AdminInput label={<>Modelo</>} value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} required /></div></div>
              <div className="admin-field-group"><AdminInput label={<>Cor</>} value={vehicleForm.color} onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })} /></div>
              <div className="form-action-row"><AdminButton className="admin-primary">{editingVehicleId ? "Salvar alterações" : "Cadastrar veículo"}</AdminButton>{editingVehicleId && <AdminButton type="button" className="admin-secondary" onClick={resetVehicleForm}>Cancelar</AdminButton>}</div>
            </Paper>
            <Paper component="div" elevation={0} className="admin-card"><h2>Veículos</h2><div className="admin-list">{vehicles.map((v) => <Paper component="article" elevation={0} key={v.id}><div className="entity-list-row"><div><b>{v.brand} {v.model}</b><span>{v.plate} • {v.color || "Cor não informada"}</span><small>{customerName(v.customerId)}</small></div><div className="entity-actions"><AdminButton type="button" className="edit-icon" onClick={() => editVehicle(v)} title="Editar veículo"><Pencil size={15} /></AdminButton><AdminButton type="button" className="danger-icon" onClick={() => removeVehicle(v)} title="Excluir veículo"><Trash2 size={15} /></AdminButton></div></div></Paper>)}</div></Paper>
          </div>}

          {tab === "servicos" && <div>
            <Paper component="form" elevation={0} className="admin-card admin-form order-form" onSubmit={addOrder}>
              <h2>{editingOrderId ? "Editar serviço / agendamento" : "Novo serviço / agendamento"}</h2>
              <div className="admin-form-row"><div className="admin-field-group"><AdminSelect label={<>Cliente</>} value={orderForm.customerId} onChange={(e) => setOrderForm({ ...orderForm, customerId: e.target.value, vehicleId: "" })} required><option value="">Selecione</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</AdminSelect></div><div className="admin-field-group"><AdminSelect label={<>Veículo</>} value={orderForm.vehicleId} onChange={(e) => setOrderForm({ ...orderForm, vehicleId: e.target.value })} required><option value="">Selecione</option>{filteredVehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} • {v.plate}</option>)}</AdminSelect></div></div>
              <div className="admin-field-group"><AdminTextarea label={<>Serviço a ser realizado</>} rows={3} value={orderForm.serviceDescription} onChange={(e) => setOrderForm({ ...orderForm, serviceDescription: e.target.value })} required placeholder="Ex.: Recuperação do para-choque dianteiro + pintura" /></div>

              <div className="purchase-product-picker service-material-picker">
                <h3>Materiais usados no serviço</h3>
                <p className="admin-muted">Selecione os produtos do estoque e a quantidade que será consumida. O custo real usa o custo médio do estoque e o valor cobrado aplica o acréscimo informado.</p>
                {products.length === 0 && <p className="admin-muted">Cadastre primeiro os materiais na aba <b>Produtos</b>.</p>}
                <div className="admin-field-group"><AdminSelect label={<>Produto</>} value={serviceMaterialForm.productId} onChange={(e) => selectServiceMaterial(e.target.value)} disabled={products.length === 0}><option value="">Selecione um produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} • estoque {Number(product.stockCurrent || 0).toLocaleString("pt-BR")} {product.unit || "un"} • custo médio {money(Number(product.avgUnitCost ?? product.lastEffectiveUnitCost ?? product.lastUnitCost ?? 0))}</option>)}</AdminSelect></div>
                <div className="admin-form-row"><div className="admin-field-group"><AdminInput label={<>Quantidade a usar</>} mask="decimal" type="number" min="0.01" step="0.01" value={serviceMaterialForm.quantity} onChange={(e) => setServiceMaterialForm({ ...serviceMaterialForm, quantity: e.target.value })} /></div><div className="admin-field-group"><AdminInput label={<>Acréscimo sobre o custo (%)</>} mask="percent" type="number" min="0" step="0.01" value={serviceMaterialForm.markupPercent} onChange={(e) => setServiceMaterialForm({ ...serviceMaterialForm, markupPercent: e.target.value })} /></div></div>
                <div className="admin-form-row"><div className="admin-field-group"><AdminInput label={<>Custo real selecionado</>} value={money(serviceMaterialRealCost)} readOnly /></div><div className="admin-field-group"><AdminInput label={<>Valor a cobrar em materiais</>} value={money(serviceMaterialCost)} readOnly /></div></div>
                <AdminButton type="button" className="admin-secondary product-add-button" onClick={addServiceMaterial} disabled={!serviceMaterialForm.productId}><Plus size={16} /> Adicionar material ao serviço</AdminButton>
              </div>

              <div className="purchase-cart service-material-cart">
                {serviceMaterials.length === 0 ? <p className="admin-muted">Nenhum material selecionado. O valor de material ficará em R$ 0,00.</p> : serviceMaterials.map((item) => <div className="purchase-cart-line" key={item.productId}><div><b>{item.productName}</b><span>{item.quantity} × custo {money(item.unitCost)} • acréscimo {Number(item.markupPercent || 0).toLocaleString("pt-BR")}% • cobrar {money(Number(item.unitSalePrice ?? (item.quantity > 0 ? item.subtotal / item.quantity : 0)))}/{products.find((p) => p.id === item.productId)?.unit || "un"}</span></div><strong>{money(item.subtotal)}</strong><AdminButton type="button" onClick={() => removeServiceMaterial(item.productId)} title="Remover material"><Trash2 size={15} /></AdminButton></div>)}
                <div className="purchase-cart-total"><span>Custo real</span><strong>{money(serviceMaterialRealCost)}</strong></div>
                <div className="purchase-cart-total"><span>Margem nos materiais</span><strong>{money(serviceMaterialMargin)}</strong></div>
                <div className="purchase-cart-total"><span>Valor cobrado em materiais</span><strong>{money(serviceMaterialCost)}</strong></div>
              </div>

              <div className="admin-form-row"><div className="admin-field-group"><AdminInput label={<>Valor material cobrado (automático)</>} value={money(serviceMaterialCost)} readOnly /></div><div className="admin-field-group"><AdminInput label={<>Valor mão de obra (R$)</>} mask="currency" type="number" min="0" step="0.01" value={orderForm.laborCost} onChange={(e) => setOrderForm({ ...orderForm, laborCost: e.target.value })} /></div></div>
              <InternalServiceCost order={{ materialRealCost: serviceMaterialRealCost, materialItems: serviceMaterials, materialCost: serviceMaterialCost, laborCost: Number(orderForm.laborCost || 0) }} />
              <div className="admin-form-row"><div className="admin-field-group"><AdminInput label={<>Data agendada</>} type="date" value={orderForm.scheduledDate} onChange={(e) => setOrderForm({ ...orderForm, scheduledDate: e.target.value })} required /></div><div className="admin-field-group"><AdminInput label={<>Estimativa de entrega</>} type="date" value={orderForm.estimatedDelivery} onChange={(e) => setOrderForm({ ...orderForm, estimatedDelivery: e.target.value })} required /></div></div>
              <div className="admin-field-group"><AdminTextarea label={<>Observações para o cliente</>} rows={2} value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} /></div>
              <div className="form-action-row"><AdminButton className="admin-primary">{editingOrderId ? "Salvar alterações do serviço" : "Agendar serviço e gerar acompanhamento"}</AdminButton>{editingOrderId && <AdminButton type="button" className="admin-secondary" onClick={() => { resetOrderForm(); if (returnToQuote) setTab("orcamentos"); }}>Cancelar</AdminButton>}</div>
            </Paper>
            <h2 className="admin-section-title">Ordens de serviço</h2>
            <OrderTable orders={orders} customerName={customerName} vehicleName={vehicleName} onStatus={updateStatus} onPayment={updatePaymentStatus} onReceipt={generatePaymentReceipt} onCopy={copyLink} onEdit={editOrder} onDelete={removeOrder} />
          </div>}

          {tab === "produtos" && <div className="admin-two-cols product-layout">
            <Paper component="form" elevation={0} className="admin-card admin-form product-create-card" onSubmit={addProduct}>
              <h2>Novo produto / material</h2>
              <p className="admin-muted">Cadastre os materiais usados pela oficina. O último custo será atualizado automaticamente a cada nova compra.</p>
              <div className="admin-field-group"><AdminInput label={<>Produto</>} value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Ex.: Verniz PU 5L" required /></div>
              <div className="admin-form-row">
                <div className="admin-field-group"><AdminInput label={<>Categoria</>} value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} placeholder="Ex.: Tintas e vernizes" /></div>
                <div className="admin-field-group"><AdminSelect label={<>Unidade</>} value={productForm.unit} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}><option value="un">Unidade</option><option value="L">Litro</option><option value="ml">ml</option><option value="kg">Kg</option><option value="g">Grama</option><option value="cx">Caixa</option><option value="kit">Kit</option><option value="rolo">Rolo</option></AdminSelect></div>
              </div>
              <div className="admin-form-row"><div className="admin-field-group"><AdminInput label={<>Estoque inicial</>} mask="decimal" type="number" min="0" step="0.01" value={productForm.stockCurrent} onChange={(e) => setProductForm({ ...productForm, stockCurrent: e.target.value })} /></div><div className="admin-field-group"><AdminInput label={<>Acréscimo padrão nos serviços (%)</>} mask="percent" type="number" min="0" step="0.01" value={productForm.defaultMarkupPercent} onChange={(e) => setProductForm({ ...productForm, defaultMarkupPercent: e.target.value })} /></div></div>
              <AdminButton className="admin-primary"><Package size={17} /> Cadastrar produto</AdminButton>
            </Paper>

            <Paper component="div" elevation={0} className="admin-card product-list-card">
              <div className="product-list-head product-list-toolbar"><div><h2>Produtos cadastrados</h2><p className="admin-muted">{products.length} produto(s) no catálogo</p><small className="product-resize-hint">Clique em um produto para expandir os detalhes de estoque e loja.</small></div>{products.length > 0 && <div className="product-expand-actions"><AdminButton type="button" className="admin-secondary" onClick={() => setAllProductsExpanded(true)}>Expandir todos</AdminButton><AdminButton type="button" className="admin-secondary" onClick={() => setAllProductsExpanded(false)}>Minimizar todos</AdminButton></div>}</div>
              <div className="admin-list product-list">
                {products.length === 0 ? <p className="admin-muted">Nenhum produto cadastrado.</p> : products.map((product) => { const isExpanded = Boolean(expandedProducts[product.id]); return <Paper component="article" elevation={0} key={product.id} className={`product-collapsible ${isExpanded ? "is-expanded" : "is-collapsed"}`}>
                  <AdminButton type="button" className="product-collapse-trigger" onClick={() => toggleProductDetails(product.id)} aria-expanded={isExpanded}>
                    <div className="product-title-row"><div><b>{product.name}</b><span>{product.category || "Sem categoria"} • estoque {Number(product.stockCurrent || 0).toLocaleString("pt-BR")} {product.unit || "un"}</span></div><div className="product-title-value"><strong>{product.avgUnitCost != null ? money(product.avgUnitCost) : product.lastUnitCost != null ? money(product.lastUnitCost) : "Sem compra"}</strong>{isExpanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}</div></div>
                  </AdminButton>
                  {isExpanded && <div className="product-collapsible-content">
                  <div className="product-last-cost"><span>Custo médio atual</span><small>{product.avgUnitCost != null ? `${money(product.avgUnitCost)} por ${product.unit || "un"}` : "Será calculado após a primeira compra"}</small></div>
                  <div className="product-last-cost"><span>Acréscimo padrão</span><small>{Number(product.defaultMarkupPercent ?? 20).toLocaleString("pt-BR")}% • preço sugerido {product.avgUnitCost != null ? money(product.avgUnitCost * (1 + Number(product.defaultMarkupPercent ?? 20) / 100)) : "após a primeira compra"}</small></div>
                  <div className="product-last-cost"><span>Última compra</span><small>{product.lastPurchaseDate ? `${dateBR(product.lastPurchaseDate)}${product.lastSupplier ? ` • ${product.lastSupplier}` : ""}${product.lastEffectiveUnitCost != null ? ` • custo c/ frete ${money(product.lastEffectiveUnitCost)}` : ""}` : "Ainda não comprado"}</small></div>
                  {product.lastQuantity != null && <small>Última quantidade: {product.lastQuantity} {product.unit || "un"}</small>}
                  <div className="stock-row">
                    <div><span>Estoque atual</span><strong>{Number(product.stockCurrent || 0).toLocaleString("pt-BR")} {product.unit || "un"}</strong></div>
                    <div className="stock-edit"><AdminInput mask="decimal" aria-label="Novo estoque" type="number" min="0" step="0.01" placeholder="Novo estoque" value={stockEdits[product.id] ?? ""} onChange={(e) => setStockEdits((current) => ({ ...current, [product.id]: e.target.value }))} /><AdminButton type="button" onClick={() => setProductStock(product)}>Atualizar</AdminButton></div>
                  </div>
                  <div className="store-product-box">
                    <div className="store-product-head">
                      <div><span>Loja online</span><small>Defina preço de venda e destaque promocional. O estoque é sincronizado automaticamente.</small></div>
                      <label className="store-toggle"><AdminInput aria-label="Publicar produto na loja" type="checkbox" checked={Boolean(storeDrafts[product.id]?.active)} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { salePrice: "", promotionEnabled: false, promotionPrice: "", promotionLabel: "Oferta", imageUrl: "" }), active: e.target.checked } }))} /><span>Publicar</span></label>
                    </div>
                    <div className="admin-form-row">
                      <div className="admin-field-group"><AdminInput label={<>Preço de venda (R$)</>} mask="currency" type="number" min="0" step="0.01" value={storeDrafts[product.id]?.salePrice ?? ""} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { active: false, promotionEnabled: false, promotionPrice: "", promotionLabel: "Oferta", imageUrl: "" }), salePrice: e.target.value } }))} placeholder="Ex.: 49,90" /></div>
                      <div className="admin-field-group"><AdminInput label={<>Imagem do produto (URL)</>} value={storeDrafts[product.id]?.imageUrl ?? ""} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { active: false, salePrice: "", promotionEnabled: false, promotionPrice: "", promotionLabel: "Oferta" }), imageUrl: e.target.value } }))} placeholder="https://..." /></div>
                    </div>
                    <div className="store-promo-row">
                      <label className="store-toggle"><AdminInput aria-label="Destacar promoção" type="checkbox" checked={Boolean(storeDrafts[product.id]?.promotionEnabled)} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { active: false, salePrice: "", promotionPrice: "", promotionLabel: "Oferta", imageUrl: "" }), promotionEnabled: e.target.checked } }))} /><span>Destacar promoção</span></label>
                      <div className="admin-field-group"><AdminInput label={<>Preço promocional (R$)</>} mask="currency" type="number" min="0" step="0.01" disabled={!storeDrafts[product.id]?.promotionEnabled} value={storeDrafts[product.id]?.promotionPrice ?? ""} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { active: false, salePrice: "", promotionEnabled: true, promotionLabel: "Oferta", imageUrl: "" }), promotionPrice: e.target.value } }))} placeholder="Ex.: 39,90" /></div>
                      <div className="admin-field-group"><AdminInput label={<>Texto do destaque</>} disabled={!storeDrafts[product.id]?.promotionEnabled} value={storeDrafts[product.id]?.promotionLabel ?? "Oferta"} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { active: false, salePrice: "", promotionEnabled: true, promotionPrice: "", imageUrl: "" }), promotionLabel: e.target.value } }))} placeholder="Oferta / Semana do cliente" /></div>
                    </div>
                    <AdminButton type="button" className="admin-secondary store-save-button" onClick={() => saveStoreProduct(product)}><ShoppingCart size={16} /> Salvar na loja</AdminButton>
                  </div>
                  </div>}
                </Paper>})}
              </div>
            </Paper>
          </div>}

          {tab === "compras" && <div>
            <div className="admin-kpis purchase-kpis">
              <Paper component="article" elevation={0}><span>Compras cadastradas</span><strong>{purchases.length}</strong></Paper>
              <Paper component="article" elevation={0}><span>Total comprado</span><strong>{money(totalPurchases)}</strong></Paper>
              <Paper component="article" elevation={0}><span>Última compra</span><strong>{lastPurchase ? money(lastPurchase.totalAmount) : "-"}</strong><small>{lastPurchase ? `${lastPurchase.supplier} • ${dateBR(lastPurchase.purchaseDate)}` : "Sem compras cadastradas"}</small></Paper>
            </div>

            <div className="admin-two-cols purchase-layout">
              <Paper component="form" elevation={0} className="admin-card admin-form" onSubmit={addPurchase}>
                <h2>{editingPurchaseId ? "Editar ordem de compra" : "Nova ordem de compra"}</h2>{editingPurchaseId && <div className="edit-purchase-banner"><span>Você está editando uma compra existente.</span><AdminButton type="button" className="admin-secondary" onClick={cancelEditPurchase}>Cancelar edição</AdminButton></div>}
                <div className="admin-field-group"><AdminInput label={<>Fornecedor</>} value={purchaseForm.supplier} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} required /></div>
                <div className="admin-form-row"><div className="admin-field-group"><AdminInput label={<>Nº da nota</>} value={purchaseForm.invoiceNumber} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoiceNumber: e.target.value })} /></div><div className="admin-field-group"><AdminInput label={<>Data da compra</>} type="date" value={purchaseForm.purchaseDate} onChange={(e) => setPurchaseForm({ ...purchaseForm, purchaseDate: e.target.value })} required /></div></div>
                <div className="admin-field-group"><AdminInput label={<>Valor do frete (R$)</>} mask="currency" type="number" min="0" step="0.01" value={purchaseForm.freightCost} onChange={(e) => setPurchaseForm({ ...purchaseForm, freightCost: e.target.value })} placeholder="0,00" /></div>
                <p className="admin-muted">O frete será rateado proporcionalmente entre os produtos e entrará no cálculo do custo médio de cada item.</p>

                <div className="purchase-product-picker">
                  <h3>Produtos / materiais</h3>
                  {products.length === 0 && <p className="admin-muted">Cadastre primeiro os materiais na aba <b>Produtos</b>.</p>}
                  <div className="admin-field-group"><AdminSelect label={<>Produto</>} value={purchaseItemForm.productId} onChange={(e) => selectPurchaseProduct(e.target.value)} disabled={products.length === 0}><option value="">Selecione um produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.lastUnitCost != null ? ` • último ${money(product.lastUnitCost)}` : ""}</option>)}</AdminSelect></div>
                  <div className="admin-form-row"><div className="admin-field-group"><AdminInput label={<>Quantidade</>} mask="decimal" type="number" min="0.01" step="0.01" value={purchaseItemForm.quantity} onChange={(e) => setPurchaseItemForm({ ...purchaseItemForm, quantity: e.target.value })} /></div><div className="admin-field-group"><AdminInput label={<>Valor unitário (R$)</>} mask="currency" type="number" min="0" step="0.01" value={purchaseItemForm.unitCost} onChange={(e) => setPurchaseItemForm({ ...purchaseItemForm, unitCost: e.target.value })} placeholder="Custo desta compra" /></div></div>
                  <AdminButton type="button" className="admin-secondary product-add-button" onClick={addPurchaseItem} disabled={!purchaseItemForm.productId}><Plus size={16} /> Adicionar à compra</AdminButton>
                </div>

                <div className="purchase-cart">
                  {purchaseItems.length === 0 ? <p className="admin-muted">Nenhum produto adicionado.</p> : purchaseItems.map((item) => <div className="purchase-cart-line" key={item.productId}><div><b>{item.productName}</b><span>{item.quantity} × {money(item.unitCost)}</span></div><strong>{money(item.subtotal)}</strong><AdminButton type="button" onClick={() => removePurchaseItem(item.productId)} title="Remover produto"><Trash2 size={15} /></AdminButton></div>)}
                  <div className="purchase-cart-summary"><div><span>Subtotal produtos</span><strong>{money(purchaseSubtotal)}</strong></div><div><span>Frete</span><strong>{money(freightCost)}</strong></div></div>
                  <div className="purchase-cart-total"><span>Total da compra</span><strong>{money(purchaseTotal)}</strong></div>
                </div>

                <div className="admin-field-group"><AdminSelect label={<>Pagamento</>} value={purchaseForm.paymentMethod} onChange={(e) => setPurchaseForm({ ...purchaseForm, paymentMethod: e.target.value })}><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Boleto</option><option>Prazo</option><option>Outro</option></AdminSelect></div>
                <div className="admin-field-group"><AdminTextarea label={<>Observações</>} rows={2} value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} /></div>
                <AdminButton className="admin-primary" disabled={purchaseItems.length === 0}>{editingPurchaseId ? "Salvar alterações" : "Cadastrar compra"} • {money(purchaseTotal)}</AdminButton>
              </Paper>

              <Paper component="div" elevation={0} className="admin-card"><h2>Histórico de compras</h2><div className="admin-list purchase-list">{purchases.length === 0 ? <p className="admin-muted">Nenhuma compra cadastrada.</p> : purchases.map((p, index) => <Paper component="article" elevation={0} key={p.id} className={index === 0 ? "latest-purchase" : ""}><div className="purchase-line"><div><b>{p.supplier}</b><span>{dateBR(p.purchaseDate)} {p.invoiceNumber ? `• NF ${p.invoiceNumber}` : ""}</span></div><strong>{money(p.totalAmount)}</strong></div>{p.items?.length ? <div className="purchase-history-items">{p.items.map((item) => <small key={`${p.id}-${item.productId}`}>{item.productName}: {item.quantity} × {money(item.unitCost)} = <b>{money(item.subtotal)}</b>{item.effectiveUnitCost != null ? ` • custo final c/ frete ${money(item.effectiveUnitCost)}/${products.find((product) => product.id === item.productId)?.unit || "un"}` : ""}</small>)}</div> : <small>{p.products || "Produtos não detalhados"}</small>}{Number(p.freightCost || 0) > 0 && <small className="purchase-freight">Frete: <b>{money(Number(p.freightCost || 0))}</b> • Produtos: {money(Number(p.subtotalAmount ?? (p.totalAmount - Number(p.freightCost || 0))))}</small>}<div className="purchase-meta"><span>{p.paymentMethod || "Pagamento não informado"}</span>{index === 0 && <em>Última compra</em>}<AdminButton type="button" className="edit-icon" onClick={() => startEditPurchase(p)} title="Editar compra"><Pencil size={15} /></AdminButton><AdminButton type="button" className="danger-icon" onClick={() => removePurchase(p.id)} title="Excluir compra"><Trash2 size={15} /></AdminButton></div></Paper>)}</div></Paper>
            </div>
          </div>}

          {tab === "vendas" && <div className="sales-page">
            <div className="admin-kpis sales-kpis">
              <Paper component="article" elevation={0}><span>Pedidos pendentes</span><strong>{pendingStoreOrders.length}</strong></Paper>
              <Paper component="article" elevation={0}><span>Vendas confirmadas</span><strong>{confirmedStoreOrders.length}</strong></Paper>
              <Paper component="article" elevation={0}><span>Faturamento em vendas</span><strong>{money(confirmedStoreOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0))}</strong></Paper>
              <Paper component="article" elevation={0}><span>Lucro bruto estimado</span><strong>{money(confirmedStoreOrders.reduce((sum, order) => sum + Number(order.profitAmount || 0), 0))}</strong></Paper>
            </div>

            <Paper component="div" elevation={0} className="admin-card sales-section">
              <div className="sales-section-head"><div><h2>Pedidos da loja</h2><p className="admin-muted">Pedidos enviados pelo site aparecem aqui. Confirme somente após combinar pagamento/retirada com o cliente.</p></div></div>
              <div className="sales-list">
                {storeOrders.length === 0 ? <p className="admin-muted">Nenhum pedido recebido pela loja.</p> : storeOrders.map((order) => {
                  const statusClass = order.status === "Confirmado" ? "confirmed" : order.status === "Cancelado" ? "cancelled" : "pending";
                  return <Paper component="article" elevation={0} key={order.id} className={`sale-order ${statusClass}`}>
                    <div className="sale-order-head"><div><span className={`sale-status ${statusClass}`}>{order.status}</span><b>Pedido #{order.id.slice(0, 8).toUpperCase()}</b><small>{dateBR(order.orderDate)} • {order.customerName} • {order.customerPhone}</small></div><strong>{money(order.totalAmount)}</strong></div>
                    <div className="sale-items">{order.items?.map((item) => <div key={`${order.id}-${item.productId}`}><span>{item.quantity}x {item.productName}</span><b>{money(item.subtotal)}</b></div>)}</div>
                    {order.status === "Confirmado" && <div className="sale-profit"><span>Custo estimado: {money(Number(order.costAmount || 0))}</span><strong>Lucro bruto: {money(Number(order.profitAmount || 0))}</strong></div>}
                    {order.status === "Pendente" && <div className="sale-actions"><AdminButton type="button" className="admin-primary" onClick={() => confirmStoreOrder(order)}>Confirmar venda e baixar estoque</AdminButton><AdminButton type="button" className="admin-secondary" onClick={() => cancelStoreOrder(order)}>Cancelar pedido</AdminButton></div>}
                  </Paper>;
                })}
              </div>
            </Paper>
          </div>}

          {tab === "orcamentos" && <div className="admin-two-cols quote-layout">
            <Paper component="div" elevation={0} className="admin-card admin-form">
              <h2>Orçamento do veículo</h2>
              <AdminButton className="admin-secondary" type="button" onClick={() => { resetOrderForm(); setReturnToQuote(true); setTab("servicos"); }}>Novo orçamento</AdminButton>
              <p className="admin-muted">Selecione uma ordem de serviço já cadastrada. O orçamento será aberto em uma versão pronta para impressão; escolha <b>Salvar como PDF</b> na janela de impressão.</p>
              <div className="admin-field-group"><AdminSelect label={<>Serviço / ordem</>} value={quoteOrderId} onChange={(e) => setQuoteOrderId(e.target.value)}><option value="">Selecione um serviço</option>{orders.map((o) => <option key={o.id} value={o.id}>{customerName(o.customerId)} • {vehicleName(o.vehicleId)} • {o.serviceDescription.slice(0, 55)}</option>)}</AdminSelect></div>
              <AdminButton className="admin-secondary" type="button" onClick={() => selectedQuoteOrder && editOrder(selectedQuoteOrder, true)} disabled={!selectedQuoteOrder}>Editar materiais e mão de obra</AdminButton>
              <p className="admin-muted">Os materiais são salvos na ordem. Imprimir não movimenta o estoque.</p>
              <AdminButton className="admin-primary quote-button" type="button" onClick={generateQuotePdf} disabled={!selectedQuoteOrder}><FileDown size={18} /> Gerar PDF / Imprimir</AdminButton>
            </Paper>

            <Paper component="div" elevation={0} className="admin-card quote-preview"><h2>Prévia do orçamento</h2>{!selectedQuoteOrder ? <p className="admin-muted">Selecione um serviço para visualizar os dados que irão para o orçamento.</p> : <>
              <div className="quote-preview-head"><div><span>Cliente</span><b>{customerName(selectedQuoteOrder.customerId)}</b></div><div><span>Veículo</span><b>{vehicleName(selectedQuoteOrder.vehicleId)}</b></div></div>
              <div className="quote-service"><span>Serviço</span><p>{selectedQuoteOrder.serviceDescription}</p>{selectedQuoteOrder.materialItems?.length ? <div className="quote-material-items">{selectedQuoteOrder.materialItems.map((item) => <small key={item.productId}>{item.productName}: {item.quantity} × {money(Number(item.unitSalePrice ?? (item.quantity > 0 ? item.subtotal / item.quantity : 0)))} = <b>{money(item.subtotal)}</b></small>)}</div> : null}</div>
              <div className="quote-values"><div><span>Material</span><b>{money(selectedQuoteOrder.materialCost)}</b></div><div><span>Mão de obra</span><b>{money(selectedQuoteOrder.laborCost)}</b></div><div className="quote-total"><span>Total</span><b>{money(Number(selectedQuoteOrder.materialCost) + Number(selectedQuoteOrder.laborCost))}</b></div></div>
              <small>Pagamento à vista via Pix ou dinheiro. Parcelamento sujeito às taxas da maquininha.</small>
              <InternalServiceCost order={selectedQuoteOrder} />
            </>}</Paper>
          </div>}

          {tab === "custos" && <ServiceCostReport orders={orders} customers={customers} vehicles={vehicles} />}

          {tab === "fechamento" && <div className="closing-page">
            <Paper component="div" elevation={0} className="closing-toolbar admin-card"><div><h2>Fechamento do mês</h2><p className="admin-muted">Resultado em regime de caixa: serviços entregues + vendas confirmadas no mês, menos compras de materiais e custos operacionais lançados.</p></div><div className="admin-field-group"><AdminInput label={<>Mês de referência</>} type="month" value={closingMonth} onChange={(e) => setClosingMonth(e.target.value)} /></div></Paper>

            <div className="admin-kpis closing-kpis">
              <Paper component="article" elevation={0}><span>Serviços entregues</span><strong>{monthOrders.length}</strong></Paper>
              <Paper component="article" elevation={0}><span>Mão de obra recebida</span><strong>{money(monthLaborRevenue)}</strong></Paper>
              <Paper component="article" elevation={0}><span>Materiais recebidos</span><strong>{money(monthMaterialRevenue)}</strong></Paper>
              <Paper component="article" elevation={0}><span>Serviços pagos</span><strong>{money(monthRevenue)}</strong></Paper><Paper component="article" elevation={0}><span>Vendas da loja</span><strong>{money(monthStoreRevenue)}</strong><small>Lucro bruto {money(monthStoreProfit)}</small></Paper><Paper component="article" elevation={0}><span>Faturamento total</span><strong>{money(monthTotalRevenue)}</strong></Paper>
              <Paper component="article" elevation={0}><span>Compras de materiais</span><strong className="negative-value">- {money(monthPurchaseCost)}</strong></Paper>
              <Paper component="article" elevation={0}><span>Custos operacionais</span><strong className="negative-value">- {money(monthOperatingCost)}</strong></Paper>
              <Paper component="article" elevation={0} className="profit-kpi"><span>Lucro líquido (caixa)</span><strong className={monthNetProfit >= 0 ? "positive-value" : "negative-value"}>{money(monthNetProfit)}</strong><small>Margem {monthTotalRevenue > 0 ? `${((monthNetProfit / monthTotalRevenue) * 100).toFixed(1)}%` : "0%"}</small></Paper>
            </div>

            <div className="admin-two-cols closing-layout">
              <Paper component="form" elevation={0} className="admin-card admin-form" onSubmit={addExpense}>
                <h2>Adicionar custo do mês</h2>
                <div className="admin-form-row"><div className="admin-field-group"><AdminSelect label={<>Categoria</>} value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}><option>Energia</option><option>Água</option><option>Aluguel</option><option>Internet</option><option>Telefone</option><option>Impostos</option><option>Combustível</option><option>Ferramentas</option><option>Manutenção</option><option>Contabilidade</option><option>Outros</option></AdminSelect></div><div className="admin-field-group"><AdminInput label={<>Data</>} type="date" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })} required /></div></div>
                <div className="admin-field-group"><AdminInput label={<>Descrição</>} value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Ex.: Conta de energia da oficina" required /></div>
                <div className="admin-field-group"><AdminInput label={<>Valor (R$)</>} mask="currency" type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required /></div>
                <AdminButton className="admin-primary">Cadastrar custo</AdminButton>
              </Paper>

              <Paper component="div" elevation={0} className="admin-card"><h2>Custos operacionais</h2><div className="admin-list expense-list">{monthExpenses.length === 0 ? <p className="admin-muted">Nenhum custo operacional lançado neste mês.</p> : monthExpenses.map((expense) => <Paper component="article" elevation={0} key={expense.id}><div className="expense-line"><div><b>{expense.category}</b><span>{expense.description} • {dateBR(expense.expenseDate)}</span></div><strong>{money(expense.amount)}</strong><AdminButton type="button" className="danger-icon" onClick={() => removeExpense(expense.id)}><Trash2 size={15} /></AdminButton></div></Paper>)}</div></Paper>
            </div>

            <Paper component="div" elevation={0} className="admin-card closing-section"><h2>Serviços entregues no mês</h2><OrderTable orders={monthOrders} customerName={customerName} vehicleName={vehicleName} onStatus={updateStatus} onPayment={updatePaymentStatus} onReceipt={generatePaymentReceipt} onCopy={copyLink} onEdit={editOrder} onDelete={removeOrder} /></Paper>
            <Paper component="div" elevation={0} className="admin-card closing-section"><h2>Vendas da loja no mês</h2><div className="admin-list purchase-list">{monthStoreOrders.length === 0 ? <p className="admin-muted">Nenhuma venda da loja confirmada neste mês.</p> : monthStoreOrders.map((order) => <Paper component="article" elevation={0} key={order.id}><div className="purchase-line"><div><b>{order.customerName}</b><span>{dateBR(order.confirmedAt || order.orderDate)} • Pedido #{order.id.slice(0, 8).toUpperCase()}</span></div><strong>{money(order.totalAmount)}</strong></div><small>{order.items?.map((item) => `${item.productName} (${item.quantity})`).join(", ")}</small><div className="sale-profit inline"><span>Custo {money(Number(order.costAmount || 0))}</span><strong>Lucro bruto {money(Number(order.profitAmount || 0))}</strong></div></Paper>)}</div></Paper>
            <Paper component="div" elevation={0} className="admin-card closing-section"><h2>Compras de materiais do mês</h2><div className="admin-list purchase-list">{monthPurchases.length === 0 ? <p className="admin-muted">Nenhuma compra de material neste mês.</p> : monthPurchases.map((p) => <Paper component="article" elevation={0} key={p.id}><div className="purchase-line"><div><b>{p.supplier}</b><span>{dateBR(p.purchaseDate)} {p.invoiceNumber ? `• NF ${p.invoiceNumber}` : ""}</span></div><strong>{money(p.totalAmount)}</strong></div><small>{p.items?.map((item) => `${item.productName} (${item.quantity})`).join(", ") || p.products || "Produtos não detalhados"}</small></Paper>)}</div></Paper>
          </div>}

          {tab === "agenda" && <OfficeCalendar orders={orders} customers={customers} vehicles={vehicles} />}
        </>}
        </div>
        </div>
      </section>

      {partialPaymentOrder && (() => {
        const total = Number(partialPaymentOrder.materialCost || 0) + Number(partialPaymentOrder.laborCost || 0);
        const amount = Number(String(partialPaymentForm.amount || "0").replace(",", ".")) || 0;
        return <Dialog open onClose={() => setPartialPaymentOrder(null)} fullWidth maxWidth="sm" className="admin-mui" aria-labelledby="payment-title">
          <DialogContent sx={{p:3,display:"grid",gap:2.5}}>
            <div className="payment-modal-head"><div><span className="eyebrow">{paymentTargetStatus === "Pago" ? "PAGAMENTO INTEGRAL" : "PAGAMENTO PARCIAL"}</span><h2 id="payment-title">{paymentTargetStatus === "Pago" ? "Confirmar pagamento" : "Registrar valor recebido"}</h2></div><AdminButton type="button" className="modal-close" aria-label="Fechar pagamento" onClick={() => setPartialPaymentOrder(null)}>×</AdminButton></div>
            <p className="admin-muted">{customerName(partialPaymentOrder.customerId)} • {vehicleName(partialPaymentOrder.vehicleId)}</p>
            <div className="payment-summary"><div><span>Total do serviço</span><b>{money(total)}</b></div><div><span>Valor recebido</span><b>{money(paymentTargetStatus === "Pago" ? total : amount)}</b></div><div className="remaining"><span>Falta receber</span><b>{money(paymentTargetStatus === "Pago" ? 0 : Math.max(0, total - amount))}</b></div></div>
            {paymentTargetStatus === "Pago parcial" && <div className="admin-field-group"><AdminInput label={<>Valor pago agora (R$)</>} mask="currency" autoFocus type="number" min="0.01" max={Math.max(0, total - 0.01)} step="0.01" value={partialPaymentForm.amount} onChange={(e) => setPartialPaymentForm({ ...partialPaymentForm, amount: e.target.value })} placeholder="0,00" /></div>}
            <div className="admin-field-group"><AdminSelect label={<>Forma de pagamento</>} value={partialPaymentForm.method} onChange={(e) => setPartialPaymentForm({ ...partialPaymentForm, method: e.target.value })}><option>Pix</option><option>Dinheiro</option><option>Cartão de débito</option><option>Cartão de crédito</option><option>Transferência</option><option>Boleto</option><option>Outro</option></AdminSelect></div>
            <div className="admin-field-group"><AdminTextarea label={<>Observações do pagamento</>} rows={4} value={partialPaymentForm.notes} onChange={(e) => setPartialPaymentForm({ ...partialPaymentForm, notes: e.target.value })} placeholder="Ex.: entrada referente ao serviço, pagamento combinado com o cliente, parcela 1/2..." /></div>
            <div className="payment-modal-actions"><AdminButton type="button" className="admin-secondary" onClick={() => setPartialPaymentOrder(null)}>Cancelar</AdminButton><AdminButton type="button" className="admin-primary" onClick={() => savePartialPayment(true)}><FileDown size={17} /> Salvar e gerar recibo PDF</AdminButton></div>
          </DialogContent>
        </Dialog>;
      })()}
      {confirmationDialog}
    </main>
  );
}

function OrderTable({
  orders,
  customerName,
  vehicleName,
  onStatus,
  onPayment,
  onReceipt,
  onCopy,
  onEdit,
  onDelete,
}: {
  orders: ServiceOrder[];
  customerName: (id: string) => string;
  vehicleName: (id: string) => string;
  onStatus: (order: ServiceOrder, status: ServiceStatus) => void;
  onPayment: (order: ServiceOrder, paymentStatus: "Pago" | "Não pago" | "Pago parcial") => void;
  onReceipt: (order: ServiceOrder) => void;
  onCopy: (token: string) => void;
  onEdit: (order: ServiceOrder) => void;
  onDelete: (order: ServiceOrder) => void;
}) {
  return <TableContainer className="admin-table-wrap"><Table className="admin-table"><TableHead><TableRow><TableCell component="th">Cliente / veículo</TableCell><TableCell component="th">Serviço</TableCell><TableCell component="th">Agenda</TableCell><TableCell component="th">Valores</TableCell><TableCell component="th">Status</TableCell><TableCell component="th">Pagamento</TableCell><TableCell component="th">Cliente</TableCell><TableCell component="th">Ações</TableCell></TableRow></TableHead><TableBody>{orders.length === 0 ? <TableRow><TableCell colSpan={8}>Nenhum serviço cadastrado.</TableCell></TableRow> : orders.map((o) => <TableRow key={o.id}><TableCell><b>{customerName(o.customerId)}</b><small>{vehicleName(o.vehicleId)}</small></TableCell><TableCell>{o.serviceDescription}</TableCell><TableCell><b>{dateBR(o.scheduledDate)}</b><small>Entrega: {dateBR(o.estimatedDelivery)}</small></TableCell><TableCell><b>{money(Number(o.materialCost) + Number(o.laborCost))}</b><small>Material {money(Number(o.materialCost))} • M.O. {money(Number(o.laborCost))}</small></TableCell><TableCell><AdminSelect label="Status" value={o.status} onChange={(e) => onStatus(o, e.target.value as ServiceStatus)}>{SERVICE_STATUSES.map((s) => <option key={s}>{s}</option>)}</AdminSelect></TableCell><TableCell><div className="payment-cell"><AdminSelect label="Pagamento" className={`payment-status-select ${(o.paymentStatus || "Não pago") === "Pago" ? "paid" : o.paymentStatus === "Pago parcial" ? "partial" : "unpaid"}`} value={o.paymentStatus || "Não pago"} onChange={(e) => onPayment(o, e.target.value as "Pago" | "Não pago" | "Pago parcial")}><option>Não pago</option><option>Pago parcial</option><option>Pago</option></AdminSelect>{o.paymentStatus === "Pago parcial" && <small>{money(Number(o.paidAmount || 0))} pago • falta {money(Math.max(0, Number(o.materialCost || 0) + Number(o.laborCost || 0) - Number(o.paidAmount || 0)))}</small>}{(o.paymentStatus === "Pago parcial" || o.paymentStatus === "Pago") && <AdminButton type="button" className="receipt-mini" onClick={() => onReceipt(o)} title={o.paymentStatus === "Pago" ? "Gerar recibo do pagamento integral" : "Gerar recibo do pagamento parcial"}><ReceiptText size={13} /> Recibo</AdminButton>}</div></TableCell><TableCell><AdminButton className="copy-link" onClick={() => onCopy(o.publicToken)}><Copy size={15} /> Copiar link</AdminButton></TableCell><TableCell><div className="table-actions"><AdminButton type="button" className="edit-icon" onClick={() => onEdit(o)} title="Editar serviço"><Pencil size={15} /></AdminButton><AdminButton type="button" className="danger-icon" onClick={() => onDelete(o)} title="Excluir serviço"><Trash2 size={15} /></AdminButton></div></TableCell></TableRow>)}</TableBody></Table></TableContainer>;
}
