"use client";

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

type Tab = "resumo" | "clientes" | "veiculos" | "servicos" | "agenda" | "produtos" | "compras" | "vendas" | "orcamentos" | "fechamento";

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
  const revenue = orders.reduce((sum, o) => sum + Number(o.materialCost || 0) + Number(o.laborCost || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
  const lastPurchase = purchases[0];
  const purchaseSubtotal = purchaseItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const freightCost = Number(purchaseForm.freightCost || 0);
  const purchaseTotal = purchaseSubtotal + freightCost;
  const serviceMaterialCost = serviceMaterials.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  const serviceMaterialRealCost = serviceMaterials.reduce((sum, item) => sum + Number(item.costSubtotal ?? (Number(item.quantity || 0) * Number(item.unitCost || 0))), 0);
  const serviceMaterialMargin = serviceMaterialCost - serviceMaterialRealCost;
  const selectedQuoteOrder = orders.find((o) => o.id === quoteOrderId);

  const monthOrders = orders.filter((o) => {
    if (o.status !== "Entregue") return false;
    const referenceDate = o.completedAt || o.estimatedDelivery || o.scheduledDate;
    return Boolean(referenceDate && referenceDate.startsWith(closingMonth));
  });
  const monthPurchases = purchases.filter((p) => p.purchaseDate?.startsWith(closingMonth));
  const monthExpenses = expenses.filter((e) => e.expenseDate?.startsWith(closingMonth));
  const monthLaborRevenue = monthOrders.reduce((sum, o) => sum + Number(o.laborCost || 0), 0);
  const monthMaterialRevenue = monthOrders.reduce((sum, o) => sum + Number(o.materialCost || 0), 0);
  const monthRevenue = monthLaborRevenue + monthMaterialRevenue;
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
    if (!window.confirm(`Excluir o cliente ${customer.name}? Esta ação não poderá ser desfeita.`)) return;
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
    if (!window.confirm(`Excluir o veículo ${vehicle.brand} ${vehicle.model} • ${vehicle.plate}?`)) return;
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
    const availableStock = Number(product.stockCurrent || 0);
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

  function editOrder(order: ServiceOrder) {
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
  }

  async function removeOrder(order: ServiceOrder) {
    if (!window.confirm(`Excluir o serviço de ${customerName(order.customerId)}? Os materiais consumidos serão devolvidos ao estoque.`)) return;
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
      createdAt: serverTimestamp(),
    });
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
    const purchaseRef = doc(collection(db, "purchaseOrders"));
    batch.set(purchaseRef, {
      ...purchaseForm,
      freightCost,
      items: allocatedItems,
      products: allocatedItems.map((item) => `${item.productName} x${item.quantity}`).join(", "),
      subtotalAmount: purchaseSubtotal,
      totalAmount: purchaseTotal,
      createdAt: serverTimestamp(),
    });

    allocatedItems.forEach((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return;

      const oldStock = Number(product.stockCurrent || 0);
      const effectiveCost = Number(item.effectiveUnitCost || item.unitCost);
      const storedAverage = Number(product.avgUnitCost ?? product.lastEffectiveUnitCost ?? product.lastUnitCost ?? 0);
      const oldAverage = storedAverage > 0 ? storedAverage : effectiveCost;
      const newStock = oldStock + item.quantity;
      const newAverage = newStock > 0
        ? ((oldStock * oldAverage) + (item.quantity * effectiveCost)) / newStock
        : effectiveCost;

      batch.update(doc(db, "products", item.productId), {
        lastUnitCost: item.unitCost,
        lastEffectiveUnitCost: item.effectiveUnitCost,
        avgUnitCost: newAverage,
        lastPurchaseDate: purchaseForm.purchaseDate,
        lastSupplier: purchaseForm.supplier,
        lastQuantity: item.quantity,
        stockCurrent: newStock,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, "storeCatalog", item.productId), {
        productId: item.productId,
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
    setNotice("Compra cadastrada. Frete rateado, custo médio atualizado e estoque incrementado.");
    await loadAll();
  }

  async function removePurchase(id: string) {
    if (!window.confirm("Deseja realmente excluir esta compra? O estoque dos itens desta compra será estornado.")) return;
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
    if (!window.confirm(`Confirmar a venda de ${money(order.totalAmount)} para ${order.customerName}? O estoque será baixado agora.`)) return;

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
    if (!window.confirm(`Cancelar o pedido de ${order.customerName}?`)) return;
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
    if (!window.confirm("Excluir este custo do fechamento mensal?")) return;
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

  function copyLink(token: string) {
    const url = `${window.location.origin}/acompanhar/${token}`;
    navigator.clipboard.writeText(url);
    setNotice("Link copiado. Envie para o cliente pelo WhatsApp.");
  }

  function generateQuotePdf() {
    if (!selectedQuoteOrder) return;

    const safe = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "\'": "&#039;" }[char] || char));
    const customer = customers.find((c) => c.id === selectedQuoteOrder.customerId);
    const vehicle = vehicles.find((v) => v.id === selectedQuoteOrder.vehicleId);
    const total = Number(selectedQuoteOrder.materialCost || 0) + Number(selectedQuoteOrder.laborCost || 0);
    const quoteWindow = window.open("", "_blank", "width=900,height=1100");

    if (!quoteWindow) {
      setNotice("O navegador bloqueou a janela do orçamento. Libere pop-ups e tente novamente.");
      return;
    }

    const html = `
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Orçamento - ${safe(customer?.name || "Cliente")}</title>
<style>
  *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#efefef;color:#151515}.page{width:210mm;min-height:297mm;margin:0 auto;background:white;padding:10mm 12mm}.header{background:#090909;color:#fff;padding:12px 18px;border-bottom:4px solid #c99523}.brand{font-size:27px;font-weight:900;letter-spacing:7px}.brand-sub{color:#d7a52d;letter-spacing:6px;font-size:12px;margin-top:2px}.brand-service{font-size:10px;letter-spacing:3px;margin-top:4px}.title{display:flex;justify-content:space-between;align-items:end;margin:14px 0 10px;border-bottom:1px solid #ddd;padding-bottom:8px}.title h1{margin:0;font-size:24px}.gold{color:#b17c13}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:9px 0}.box{border:1px solid #ddd;border-radius:7px;padding:8px 10px}.box span{display:block;font-size:9px;color:#777;text-transform:uppercase;margin-bottom:3px}.box b{font-size:12px}.service{margin:10px 0;border:1px solid #ddd;border-radius:7px;padding:10px 12px}.service h3{margin:0 0 5px;color:#9b6c0d;font-size:14px}.service p{margin:4px 0;font-size:12px}.values{width:100%;border-collapse:collapse;margin:8px 0}.values td{padding:8px 10px;border-bottom:1px solid #ddd;font-size:12px}.values td:last-child{text-align:right;font-weight:700}.values .total td{font-size:16px;background:#f4e4bd;border:0}.payment{background:#111;color:#fff;border-left:4px solid #c99523;padding:8px 10px;margin:9px 0;font-size:10px;line-height:1.35}.notes{border:1px solid #ddd;border-radius:7px;padding:9px 10px;min-height:48px;font-size:11px}.footer{margin-top:12px;border-top:1px solid #ddd;padding-top:8px;text-align:center;font-size:9px;color:#555;line-height:1.35}.signature{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin-top:22px;text-align:center;font-size:10px}.signature div{border-top:1px solid #333;padding-top:5px}@page{size:A4 portrait;margin:0}@media print{html,body{width:210mm;height:297mm;background:#fff}.page{margin:0;width:210mm;min-height:0;height:297mm;padding:8mm 10mm;overflow:hidden}.header{padding:10px 16px}.title{margin:10px 0 8px}.grid{margin:7px 0}.service{margin:7px 0;padding:8px 10px}.values{margin:6px 0}.values td{padding:6px 9px}.payment{margin:7px 0;padding:7px 9px}.notes{min-height:38px;padding:7px 9px}.signature{margin-top:16px}.footer{margin-top:8px;padding-top:6px}button{display:none}}
</style>
</head>
<body>
<div class="page">
  <header class="header"><div class="brand">FELIPE</div><div class="brand-sub">AUTO DESIGN</div><div class="brand-service">FUNILARIA • PINTURA • ESTÉTICA AUTOMOTIVA</div></header>
  <div class="title"><h1>ORÇAMENTO</h1><div><b>Data:</b> ${new Date().toLocaleDateString("pt-BR")}</div></div>

  <div class="grid">
    <div class="box"><span>Cliente</span><b>${safe(customer?.name || "Cliente")}</b></div>
    <div class="box"><span>WhatsApp</span><b>${safe(customer?.phone || "-")}</b></div>
    <div class="box"><span>Veículo</span><b>${safe(vehicle ? `${vehicle.brand} ${vehicle.model}` : "-")}</b></div>
    <div class="box"><span>Placa</span><b>${safe(vehicle?.plate || "-")}</b></div>
  </div>

  <div class="service"><h3>Serviço proposto</h3><p>${safe(selectedQuoteOrder.serviceDescription)}</p>${selectedQuoteOrder.materialItems?.length ? `<hr style="border:0;border-top:1px solid #ddd;margin:14px 0"/><h4 style="margin:0 0 8px">Materiais previstos</h4>${selectedQuoteOrder.materialItems.map((item) => `<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span>${safe(item.productName)} • ${item.quantity} × ${money(Number(item.unitSalePrice ?? item.unitCost))}</span><b>${money(item.subtotal)}</b></div>`).join("")}` : ""}</div>

  <table class="values">
    <tr><td>Material</td><td>${money(Number(selectedQuoteOrder.materialCost || 0))}</td></tr>
    <tr><td>Mão de obra</td><td>${money(Number(selectedQuoteOrder.laborCost || 0))}</td></tr>
    <tr class="total"><td><b>VALOR TOTAL</b></td><td><b>${money(total)}</b></td></tr>
  </table>

  <div class="grid">
    <div class="box"><span>Data agendada</span><b>${dateBR(selectedQuoteOrder.scheduledDate)}</b></div>
    <div class="box"><span>Estimativa de entrega</span><b>${dateBR(selectedQuoteOrder.estimatedDelivery)}</b></div>
  </div>

  <div class="payment"><b>Condições de pagamento:</b><br/>Valores à vista via Pix ou dinheiro. Para pagamento parcelado, serão acrescentadas as taxas da maquininha.</div>
  <div class="notes"><b>Observações</b><br/><br/>${safe(selectedQuoteOrder.notes || "Sem observações adicionais.")}</div>

  <div class="signature"><div>Assinatura do cliente</div><div>Felipe Auto Design</div></div>
  <footer class="footer"><b>Felipe Auto Design</b><br/>Avenida Alfredo de Faria, 87 - Tutunas - Uberaba/MG<br/>(34) 99154-3776 • @felipeautodesign • www.felipeautodesign.com.br</footer>
  <footer class="footer"><b>CNPJ: 52.198.532/0001-89</b>
  <footer class="footer"><b>Orçamento válido até 30 dias.</b>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
</body>
</html>`;

    quoteWindow.document.open();
    quoteWindow.document.write(html);
    quoteWindow.document.close();
  }

  if (!authorized) return <main className="admin-loading">Carregando área da oficina...</main>;

  return (
    <main className="admin-page">
      <section className="admin-hero container">
        <div>
          <span className="eyebrow">GESTÃO DA OFICINA</span>
          <h1>Painel Felipe Auto Design</h1>
          <p>Clientes, veículos, ordens de serviço, produtos, estoque, compras, fechamento mensal, custos, agenda e acompanhamento do cliente em um só lugar.</p>
        </div>
        <div className="admin-actions">
          <button onClick={loadAll}><RefreshCw size={17} /> Atualizar</button>
          <button onClick={() => signOut(auth)}><LogOut size={17} /> Sair</button>
        </div>
      </section>

      <section className="container admin-shell">
        {notice && <div className="admin-notice" onClick={() => setNotice("")}>{notice}</div>}

        <div className="admin-workspace">
        <nav className="admin-tabs" aria-label="Navegação do painel">
          <button className={tab === "resumo" ? "active" : ""} onClick={() => setTab("resumo")}><ClipboardList size={17} />Resumo</button>
          <button className={tab === "clientes" ? "active" : ""} onClick={() => setTab("clientes")}><Users size={17} />Clientes</button>
          <button className={tab === "veiculos" ? "active" : ""} onClick={() => setTab("veiculos")}><Car size={17} />Veículos</button>
          <button className={tab === "servicos" ? "active" : ""} onClick={() => setTab("servicos")}><Plus size={17} />Serviços</button>
          <button className={tab === "produtos" ? "active" : ""} onClick={() => setTab("produtos")}><Package size={17} />Produtos</button>
          <button className={tab === "compras" ? "active" : ""} onClick={() => setTab("compras")}><ShoppingCart size={17} />Compras</button>
          <button className={tab === "vendas" ? "active" : ""} onClick={() => setTab("vendas")}><BadgeDollarSign size={17} />Vendas{pendingStoreOrders.length > 0 ? ` (${pendingStoreOrders.length})` : ""}</button>
          <button className={tab === "orcamentos" ? "active" : ""} onClick={() => setTab("orcamentos")}><ReceiptText size={17} />Orçamentos</button>
          <button className={tab === "fechamento" ? "active" : ""} onClick={() => setTab("fechamento")}><WalletCards size={17} />Fechamento</button>
          <button className={tab === "agenda" ? "active" : ""} onClick={() => setTab("agenda")}><CalendarDays size={17} />Agenda</button>
        </nav>

        <div className="admin-content">
        {loading ? <div className="admin-loading">Carregando dados...</div> : <>
          {tab === "resumo" && <div>
            <div className="admin-kpis admin-kpis-five">
              <article><span>Clientes</span><strong>{customers.length}</strong></article>
              <article><span>Veículos</span><strong>{vehicles.length}</strong></article>
              <article><span>Serviços em andamento</span><strong>{openOrders.length}</strong></article>
              <article><span>Valor dos serviços</span><strong>{money(revenue)}</strong></article>
              <article><span>Última compra</span><strong>{lastPurchase ? money(lastPurchase.totalAmount) : "-"}</strong><small>{lastPurchase ? dateBR(lastPurchase.purchaseDate) : "Sem compras"}</small></article>
            </div>
            <h2 className="admin-section-title">Serviços recentes</h2>
            <OrderTable orders={orders.slice(0, 8)} customerName={customerName} vehicleName={vehicleName} onStatus={updateStatus} onCopy={copyLink} onEdit={editOrder} onDelete={removeOrder} />
          </div>}

          {tab === "clientes" && <div className="admin-two-cols">
            <form className="admin-card admin-form" onSubmit={addCustomer}>
              <h2>{editingCustomerId ? "Editar cliente" : "Novo cliente"}</h2>
              <label><span>Nome *</span><input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} required /></label>
              <label><span>WhatsApp *</span><input value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} required /></label>
              <label><span>E-mail</span><input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} /></label>
              <label><span>CPF/CNPJ</span><input value={clientForm.cpfCnpj} onChange={(e) => setClientForm({ ...clientForm, cpfCnpj: e.target.value })} /></label>
              <label><span>Endereço</span><input value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} /></label>
              <div className="form-action-row"><button className="admin-primary">{editingCustomerId ? "Salvar alterações" : "Cadastrar cliente"}</button>{editingCustomerId && <button type="button" className="admin-secondary" onClick={resetCustomerForm}>Cancelar</button>}</div>
            </form>
            <div className="admin-card"><h2>Clientes cadastrados</h2><div className="admin-list">{customers.map((c) => <article key={c.id}><div className="entity-list-row"><div><b>{c.name}</b><span>{c.phone}</span><small>{c.email || c.cpfCnpj || c.address || "Sem dados adicionais"}</small></div><div className="entity-actions"><button type="button" className="edit-icon" onClick={() => editCustomer(c)} title="Editar cliente"><Pencil size={15} /></button><button type="button" className="danger-icon" onClick={() => removeCustomer(c)} title="Excluir cliente"><Trash2 size={15} /></button></div></div></article>)}</div></div>
          </div>}

          {tab === "veiculos" && <div className="admin-two-cols">
            <form className="admin-card admin-form" onSubmit={addVehicle}>
              <h2>{editingVehicleId ? "Editar veículo" : "Novo veículo"}</h2>
              <label><span>Cliente *</span><select value={vehicleForm.customerId} onChange={(e) => setVehicleForm({ ...vehicleForm, customerId: e.target.value })} required><option value="">Selecione</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <div className="admin-form-row"><label><span>Placa *</span><input value={vehicleForm.plate} onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })} required /></label><label><span>Ano</span><input value={vehicleForm.year} onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })} /></label></div>
              <div className="admin-form-row"><label><span>Marca *</span><input value={vehicleForm.brand} onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })} required /></label><label><span>Modelo *</span><input value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} required /></label></div>
              <label><span>Cor</span><input value={vehicleForm.color} onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })} /></label>
              <div className="form-action-row"><button className="admin-primary">{editingVehicleId ? "Salvar alterações" : "Cadastrar veículo"}</button>{editingVehicleId && <button type="button" className="admin-secondary" onClick={resetVehicleForm}>Cancelar</button>}</div>
            </form>
            <div className="admin-card"><h2>Veículos</h2><div className="admin-list">{vehicles.map((v) => <article key={v.id}><div className="entity-list-row"><div><b>{v.brand} {v.model}</b><span>{v.plate} • {v.color || "Cor não informada"}</span><small>{customerName(v.customerId)}</small></div><div className="entity-actions"><button type="button" className="edit-icon" onClick={() => editVehicle(v)} title="Editar veículo"><Pencil size={15} /></button><button type="button" className="danger-icon" onClick={() => removeVehicle(v)} title="Excluir veículo"><Trash2 size={15} /></button></div></div></article>)}</div></div>
          </div>}

          {tab === "servicos" && <div>
            <form className="admin-card admin-form order-form" onSubmit={addOrder}>
              <h2>{editingOrderId ? "Editar serviço / agendamento" : "Novo serviço / agendamento"}</h2>
              <div className="admin-form-row"><label><span>Cliente *</span><select value={orderForm.customerId} onChange={(e) => setOrderForm({ ...orderForm, customerId: e.target.value, vehicleId: "" })} required><option value="">Selecione</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label><span>Veículo *</span><select value={orderForm.vehicleId} onChange={(e) => setOrderForm({ ...orderForm, vehicleId: e.target.value })} required><option value="">Selecione</option>{filteredVehicles.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} • {v.plate}</option>)}</select></label></div>
              <label><span>Serviço a ser realizado *</span><textarea rows={3} value={orderForm.serviceDescription} onChange={(e) => setOrderForm({ ...orderForm, serviceDescription: e.target.value })} required placeholder="Ex.: Recuperação do para-choque dianteiro + pintura" /></label>

              <div className="purchase-product-picker service-material-picker">
                <h3>Materiais usados no serviço</h3>
                <p className="admin-muted">Selecione os produtos do estoque e a quantidade que será consumida. O custo real usa o custo médio do estoque e o valor cobrado aplica o acréscimo informado.</p>
                {products.length === 0 && <p className="admin-muted">Cadastre primeiro os materiais na aba <b>Produtos</b>.</p>}
                <label><span>Produto</span><select value={serviceMaterialForm.productId} onChange={(e) => selectServiceMaterial(e.target.value)} disabled={products.length === 0}><option value="">Selecione um produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} • estoque {Number(product.stockCurrent || 0).toLocaleString("pt-BR")} {product.unit || "un"} • custo médio {money(Number(product.avgUnitCost ?? product.lastEffectiveUnitCost ?? product.lastUnitCost ?? 0))}</option>)}</select></label>
                <div className="admin-form-row"><label><span>Quantidade a usar</span><input type="number" min="0.01" step="0.01" value={serviceMaterialForm.quantity} onChange={(e) => setServiceMaterialForm({ ...serviceMaterialForm, quantity: e.target.value })} /></label><label><span>Acréscimo sobre o custo (%)</span><input type="number" min="0" step="0.01" value={serviceMaterialForm.markupPercent} onChange={(e) => setServiceMaterialForm({ ...serviceMaterialForm, markupPercent: e.target.value })} /></label></div>
                <div className="admin-form-row"><label><span>Custo real selecionado</span><input value={money(serviceMaterialRealCost)} readOnly /></label><label><span>Valor a cobrar em materiais</span><input value={money(serviceMaterialCost)} readOnly /></label></div>
                <button type="button" className="admin-secondary product-add-button" onClick={addServiceMaterial} disabled={!serviceMaterialForm.productId}><Plus size={16} /> Adicionar material ao serviço</button>
              </div>

              <div className="purchase-cart service-material-cart">
                {serviceMaterials.length === 0 ? <p className="admin-muted">Nenhum material selecionado. O valor de material ficará em R$ 0,00.</p> : serviceMaterials.map((item) => <div className="purchase-cart-line" key={item.productId}><div><b>{item.productName}</b><span>{item.quantity} × custo {money(item.unitCost)} • acréscimo {Number(item.markupPercent || 0).toLocaleString("pt-BR")}% • cobrar {money(Number(item.unitSalePrice ?? item.unitCost))}/{products.find((p) => p.id === item.productId)?.unit || "un"}</span></div><strong>{money(item.subtotal)}</strong><button type="button" onClick={() => removeServiceMaterial(item.productId)} title="Remover material"><Trash2 size={15} /></button></div>)}
                <div className="purchase-cart-total"><span>Custo real</span><strong>{money(serviceMaterialRealCost)}</strong></div>
                <div className="purchase-cart-total"><span>Margem nos materiais</span><strong>{money(serviceMaterialMargin)}</strong></div>
                <div className="purchase-cart-total"><span>Valor cobrado em materiais</span><strong>{money(serviceMaterialCost)}</strong></div>
              </div>

              <div className="admin-form-row"><label><span>Valor material cobrado (automático)</span><input value={money(serviceMaterialCost)} readOnly /></label><label><span>Valor mão de obra (R$)</span><input type="number" min="0" step="0.01" value={orderForm.laborCost} onChange={(e) => setOrderForm({ ...orderForm, laborCost: e.target.value })} /></label></div>
              <div className="admin-form-row"><label><span>Data agendada *</span><input type="date" value={orderForm.scheduledDate} onChange={(e) => setOrderForm({ ...orderForm, scheduledDate: e.target.value })} required /></label><label><span>Estimativa de entrega *</span><input type="date" value={orderForm.estimatedDelivery} onChange={(e) => setOrderForm({ ...orderForm, estimatedDelivery: e.target.value })} required /></label></div>
              <label><span>Observações para o cliente</span><textarea rows={2} value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} /></label>
              <div className="form-action-row"><button className="admin-primary">{editingOrderId ? "Salvar alterações do serviço" : "Agendar serviço e gerar acompanhamento"}</button>{editingOrderId && <button type="button" className="admin-secondary" onClick={resetOrderForm}>Cancelar</button>}</div>
            </form>
            <h2 className="admin-section-title">Ordens de serviço</h2>
            <OrderTable orders={orders} customerName={customerName} vehicleName={vehicleName} onStatus={updateStatus} onCopy={copyLink} onEdit={editOrder} onDelete={removeOrder} />
          </div>}

          {tab === "produtos" && <div className="admin-two-cols product-layout">
            <form className="admin-card admin-form product-create-card" onSubmit={addProduct}>
              <h2>Novo produto / material</h2>
              <p className="admin-muted">Cadastre os materiais usados pela oficina. O último custo será atualizado automaticamente a cada nova compra.</p>
              <label><span>Produto *</span><input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Ex.: Verniz PU 5L" required /></label>
              <div className="admin-form-row">
                <label><span>Categoria</span><input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} placeholder="Ex.: Tintas e vernizes" /></label>
                <label><span>Unidade</span><select value={productForm.unit} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}><option value="un">Unidade</option><option value="L">Litro</option><option value="ml">ml</option><option value="kg">Kg</option><option value="g">Grama</option><option value="cx">Caixa</option><option value="kit">Kit</option><option value="rolo">Rolo</option></select></label>
              </div>
              <div className="admin-form-row"><label><span>Estoque inicial</span><input type="number" min="0" step="0.01" value={productForm.stockCurrent} onChange={(e) => setProductForm({ ...productForm, stockCurrent: e.target.value })} /></label><label><span>Acréscimo padrão nos serviços (%)</span><input type="number" min="0" step="0.01" value={productForm.defaultMarkupPercent} onChange={(e) => setProductForm({ ...productForm, defaultMarkupPercent: e.target.value })} /></label></div>
              <button className="admin-primary"><Package size={17} /> Cadastrar produto</button>
            </form>

            <div className="admin-card product-list-card">
              <div className="product-list-head product-list-toolbar"><div><h2>Produtos cadastrados</h2><p className="admin-muted">{products.length} produto(s) no catálogo</p><small className="product-resize-hint">Clique em um produto para expandir os detalhes de estoque e loja.</small></div>{products.length > 0 && <div className="product-expand-actions"><button type="button" className="admin-secondary" onClick={() => setAllProductsExpanded(true)}>Expandir todos</button><button type="button" className="admin-secondary" onClick={() => setAllProductsExpanded(false)}>Minimizar todos</button></div>}</div>
              <div className="admin-list product-list">
                {products.length === 0 ? <p className="admin-muted">Nenhum produto cadastrado.</p> : products.map((product) => { const isExpanded = Boolean(expandedProducts[product.id]); return <article key={product.id} className={`product-collapsible ${isExpanded ? "is-expanded" : "is-collapsed"}`}>
                  <button type="button" className="product-collapse-trigger" onClick={() => toggleProductDetails(product.id)} aria-expanded={isExpanded}>
                    <div className="product-title-row"><div><b>{product.name}</b><span>{product.category || "Sem categoria"} • estoque {Number(product.stockCurrent || 0).toLocaleString("pt-BR")} {product.unit || "un"}</span></div><div className="product-title-value"><strong>{product.avgUnitCost != null ? money(product.avgUnitCost) : product.lastUnitCost != null ? money(product.lastUnitCost) : "Sem compra"}</strong>{isExpanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}</div></div>
                  </button>
                  {isExpanded && <div className="product-collapsible-content">
                  <div className="product-last-cost"><span>Custo médio atual</span><small>{product.avgUnitCost != null ? `${money(product.avgUnitCost)} por ${product.unit || "un"}` : "Será calculado após a primeira compra"}</small></div>
                  <div className="product-last-cost"><span>Acréscimo padrão</span><small>{Number(product.defaultMarkupPercent ?? 20).toLocaleString("pt-BR")}% • preço sugerido {product.avgUnitCost != null ? money(product.avgUnitCost * (1 + Number(product.defaultMarkupPercent ?? 20) / 100)) : "após a primeira compra"}</small></div>
                  <div className="product-last-cost"><span>Última compra</span><small>{product.lastPurchaseDate ? `${dateBR(product.lastPurchaseDate)}${product.lastSupplier ? ` • ${product.lastSupplier}` : ""}${product.lastEffectiveUnitCost != null ? ` • custo c/ frete ${money(product.lastEffectiveUnitCost)}` : ""}` : "Ainda não comprado"}</small></div>
                  {product.lastQuantity != null && <small>Última quantidade: {product.lastQuantity} {product.unit || "un"}</small>}
                  <div className="stock-row">
                    <div><span>Estoque atual</span><strong>{Number(product.stockCurrent || 0).toLocaleString("pt-BR")} {product.unit || "un"}</strong></div>
                    <div className="stock-edit"><input type="number" min="0" step="0.01" placeholder="Novo estoque" value={stockEdits[product.id] ?? ""} onChange={(e) => setStockEdits((current) => ({ ...current, [product.id]: e.target.value }))} /><button type="button" onClick={() => setProductStock(product)}>Atualizar</button></div>
                  </div>
                  <div className="store-product-box">
                    <div className="store-product-head">
                      <div><span>Loja online</span><small>Defina preço de venda e destaque promocional. O estoque é sincronizado automaticamente.</small></div>
                      <label className="store-toggle"><input type="checkbox" checked={Boolean(storeDrafts[product.id]?.active)} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { salePrice: "", promotionEnabled: false, promotionPrice: "", promotionLabel: "Oferta", imageUrl: "" }), active: e.target.checked } }))} /><span>Publicar</span></label>
                    </div>
                    <div className="admin-form-row">
                      <label><span>Preço de venda (R$)</span><input type="number" min="0" step="0.01" value={storeDrafts[product.id]?.salePrice ?? ""} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { active: false, promotionEnabled: false, promotionPrice: "", promotionLabel: "Oferta", imageUrl: "" }), salePrice: e.target.value } }))} placeholder="Ex.: 49,90" /></label>
                      <label><span>Imagem do produto (URL)</span><input value={storeDrafts[product.id]?.imageUrl ?? ""} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { active: false, salePrice: "", promotionEnabled: false, promotionPrice: "", promotionLabel: "Oferta" }), imageUrl: e.target.value } }))} placeholder="https://..." /></label>
                    </div>
                    <div className="store-promo-row">
                      <label className="store-toggle"><input type="checkbox" checked={Boolean(storeDrafts[product.id]?.promotionEnabled)} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { active: false, salePrice: "", promotionPrice: "", promotionLabel: "Oferta", imageUrl: "" }), promotionEnabled: e.target.checked } }))} /><span>Destacar promoção</span></label>
                      <label><span>Preço promocional (R$)</span><input type="number" min="0" step="0.01" disabled={!storeDrafts[product.id]?.promotionEnabled} value={storeDrafts[product.id]?.promotionPrice ?? ""} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { active: false, salePrice: "", promotionEnabled: true, promotionLabel: "Oferta", imageUrl: "" }), promotionPrice: e.target.value } }))} placeholder="Ex.: 39,90" /></label>
                      <label><span>Texto do destaque</span><input disabled={!storeDrafts[product.id]?.promotionEnabled} value={storeDrafts[product.id]?.promotionLabel ?? "Oferta"} onChange={(e) => setStoreDrafts((current) => ({ ...current, [product.id]: { ...(current[product.id] || { active: false, salePrice: "", promotionEnabled: true, promotionPrice: "", imageUrl: "" }), promotionLabel: e.target.value } }))} placeholder="Oferta / Semana do cliente" /></label>
                    </div>
                    <button type="button" className="admin-secondary store-save-button" onClick={() => saveStoreProduct(product)}><ShoppingCart size={16} /> Salvar na loja</button>
                  </div>
                  </div>}
                </article>})}
              </div>
            </div>
          </div>}

          {tab === "compras" && <div>
            <div className="admin-kpis purchase-kpis">
              <article><span>Compras cadastradas</span><strong>{purchases.length}</strong></article>
              <article><span>Total comprado</span><strong>{money(totalPurchases)}</strong></article>
              <article><span>Última compra</span><strong>{lastPurchase ? money(lastPurchase.totalAmount) : "-"}</strong><small>{lastPurchase ? `${lastPurchase.supplier} • ${dateBR(lastPurchase.purchaseDate)}` : "Sem compras cadastradas"}</small></article>
            </div>

            <div className="admin-two-cols purchase-layout">
              <form className="admin-card admin-form" onSubmit={addPurchase}>
                <h2>Nova ordem de compra</h2>
                <label><span>Fornecedor *</span><input value={purchaseForm.supplier} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })} required /></label>
                <div className="admin-form-row"><label><span>Nº da nota</span><input value={purchaseForm.invoiceNumber} onChange={(e) => setPurchaseForm({ ...purchaseForm, invoiceNumber: e.target.value })} /></label><label><span>Data da compra *</span><input type="date" value={purchaseForm.purchaseDate} onChange={(e) => setPurchaseForm({ ...purchaseForm, purchaseDate: e.target.value })} required /></label></div>
                <label><span>Valor do frete (R$)</span><input type="number" min="0" step="0.01" value={purchaseForm.freightCost} onChange={(e) => setPurchaseForm({ ...purchaseForm, freightCost: e.target.value })} placeholder="0,00" /></label>
                <p className="admin-muted">O frete será rateado proporcionalmente entre os produtos e entrará no cálculo do custo médio de cada item.</p>

                <div className="purchase-product-picker">
                  <h3>Produtos / materiais</h3>
                  {products.length === 0 && <p className="admin-muted">Cadastre primeiro os materiais na aba <b>Produtos</b>.</p>}
                  <label><span>Produto</span><select value={purchaseItemForm.productId} onChange={(e) => selectPurchaseProduct(e.target.value)} disabled={products.length === 0}><option value="">Selecione um produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.lastUnitCost != null ? ` • último ${money(product.lastUnitCost)}` : ""}</option>)}</select></label>
                  <div className="admin-form-row"><label><span>Quantidade</span><input type="number" min="0.01" step="0.01" value={purchaseItemForm.quantity} onChange={(e) => setPurchaseItemForm({ ...purchaseItemForm, quantity: e.target.value })} /></label><label><span>Valor unitário (R$)</span><input type="number" min="0" step="0.01" value={purchaseItemForm.unitCost} onChange={(e) => setPurchaseItemForm({ ...purchaseItemForm, unitCost: e.target.value })} placeholder="Custo desta compra" /></label></div>
                  <button type="button" className="admin-secondary product-add-button" onClick={addPurchaseItem} disabled={!purchaseItemForm.productId}><Plus size={16} /> Adicionar à compra</button>
                </div>

                <div className="purchase-cart">
                  {purchaseItems.length === 0 ? <p className="admin-muted">Nenhum produto adicionado.</p> : purchaseItems.map((item) => <div className="purchase-cart-line" key={item.productId}><div><b>{item.productName}</b><span>{item.quantity} × {money(item.unitCost)}</span></div><strong>{money(item.subtotal)}</strong><button type="button" onClick={() => removePurchaseItem(item.productId)} title="Remover produto"><Trash2 size={15} /></button></div>)}
                  <div className="purchase-cart-summary"><div><span>Subtotal produtos</span><strong>{money(purchaseSubtotal)}</strong></div><div><span>Frete</span><strong>{money(freightCost)}</strong></div></div>
                  <div className="purchase-cart-total"><span>Total da compra</span><strong>{money(purchaseTotal)}</strong></div>
                </div>

                <label><span>Pagamento</span><select value={purchaseForm.paymentMethod} onChange={(e) => setPurchaseForm({ ...purchaseForm, paymentMethod: e.target.value })}><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Boleto</option><option>Prazo</option><option>Outro</option></select></label>
                <label><span>Observações</span><textarea rows={2} value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} /></label>
                <button className="admin-primary" disabled={purchaseItems.length === 0}>Cadastrar compra • {money(purchaseTotal)}</button>
              </form>

              <div className="admin-card"><h2>Histórico de compras</h2><div className="admin-list purchase-list">{purchases.length === 0 ? <p className="admin-muted">Nenhuma compra cadastrada.</p> : purchases.map((p, index) => <article key={p.id} className={index === 0 ? "latest-purchase" : ""}><div className="purchase-line"><div><b>{p.supplier}</b><span>{dateBR(p.purchaseDate)} {p.invoiceNumber ? `• NF ${p.invoiceNumber}` : ""}</span></div><strong>{money(p.totalAmount)}</strong></div>{p.items?.length ? <div className="purchase-history-items">{p.items.map((item) => <small key={`${p.id}-${item.productId}`}>{item.productName}: {item.quantity} × {money(item.unitCost)} = <b>{money(item.subtotal)}</b>{item.effectiveUnitCost != null ? ` • custo final c/ frete ${money(item.effectiveUnitCost)}/${products.find((product) => product.id === item.productId)?.unit || "un"}` : ""}</small>)}</div> : <small>{p.products || "Produtos não detalhados"}</small>}{Number(p.freightCost || 0) > 0 && <small className="purchase-freight">Frete: <b>{money(Number(p.freightCost || 0))}</b> • Produtos: {money(Number(p.subtotalAmount ?? (p.totalAmount - Number(p.freightCost || 0))))}</small>}<div className="purchase-meta"><span>{p.paymentMethod || "Pagamento não informado"}</span>{index === 0 && <em>Última compra</em>}<button type="button" className="danger-icon" onClick={() => removePurchase(p.id)} title="Excluir compra"><Trash2 size={15} /></button></div></article>)}</div></div>
            </div>
          </div>}

          {tab === "vendas" && <div className="sales-page">
            <div className="admin-kpis sales-kpis">
              <article><span>Pedidos pendentes</span><strong>{pendingStoreOrders.length}</strong></article>
              <article><span>Vendas confirmadas</span><strong>{confirmedStoreOrders.length}</strong></article>
              <article><span>Faturamento em vendas</span><strong>{money(confirmedStoreOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0))}</strong></article>
              <article><span>Lucro bruto estimado</span><strong>{money(confirmedStoreOrders.reduce((sum, order) => sum + Number(order.profitAmount || 0), 0))}</strong></article>
            </div>

            <div className="admin-card sales-section">
              <div className="sales-section-head"><div><h2>Pedidos da loja</h2><p className="admin-muted">Pedidos enviados pelo site aparecem aqui. Confirme somente após combinar pagamento/retirada com o cliente.</p></div></div>
              <div className="sales-list">
                {storeOrders.length === 0 ? <p className="admin-muted">Nenhum pedido recebido pela loja.</p> : storeOrders.map((order) => {
                  const statusClass = order.status === "Confirmado" ? "confirmed" : order.status === "Cancelado" ? "cancelled" : "pending";
                  return <article key={order.id} className={`sale-order ${statusClass}`}>
                    <div className="sale-order-head"><div><span className={`sale-status ${statusClass}`}>{order.status}</span><b>Pedido #{order.id.slice(0, 8).toUpperCase()}</b><small>{dateBR(order.orderDate)} • {order.customerName} • {order.customerPhone}</small></div><strong>{money(order.totalAmount)}</strong></div>
                    <div className="sale-items">{order.items?.map((item) => <div key={`${order.id}-${item.productId}`}><span>{item.quantity}x {item.productName}</span><b>{money(item.subtotal)}</b></div>)}</div>
                    {order.status === "Confirmado" && <div className="sale-profit"><span>Custo estimado: {money(Number(order.costAmount || 0))}</span><strong>Lucro bruto: {money(Number(order.profitAmount || 0))}</strong></div>}
                    {order.status === "Pendente" && <div className="sale-actions"><button type="button" className="admin-primary" onClick={() => confirmStoreOrder(order)}>Confirmar venda e baixar estoque</button><button type="button" className="admin-secondary" onClick={() => cancelStoreOrder(order)}>Cancelar pedido</button></div>}
                  </article>;
                })}
              </div>
            </div>
          </div>}

          {tab === "orcamentos" && <div className="admin-two-cols quote-layout">
            <div className="admin-card admin-form">
              <h2>Gerar orçamento em PDF</h2>
              <p className="admin-muted">Selecione uma ordem de serviço já cadastrada. O orçamento será aberto em uma versão pronta para impressão; escolha <b>Salvar como PDF</b> na janela de impressão.</p>
              <label><span>Serviço / ordem *</span><select value={quoteOrderId} onChange={(e) => setQuoteOrderId(e.target.value)}><option value="">Selecione um serviço</option>{orders.map((o) => <option key={o.id} value={o.id}>{customerName(o.customerId)} • {vehicleName(o.vehicleId)} • {o.serviceDescription.slice(0, 55)}</option>)}</select></label>
              <button className="admin-primary quote-button" type="button" onClick={generateQuotePdf} disabled={!selectedQuoteOrder}><FileDown size={18} /> Gerar PDF / Imprimir</button>
            </div>

            <div className="admin-card quote-preview"><h2>Prévia do orçamento</h2>{!selectedQuoteOrder ? <p className="admin-muted">Selecione um serviço para visualizar os dados que irão para o orçamento.</p> : <>
              <div className="quote-preview-head"><div><span>Cliente</span><b>{customerName(selectedQuoteOrder.customerId)}</b></div><div><span>Veículo</span><b>{vehicleName(selectedQuoteOrder.vehicleId)}</b></div></div>
              <div className="quote-service"><span>Serviço</span><p>{selectedQuoteOrder.serviceDescription}</p>{selectedQuoteOrder.materialItems?.length ? <div className="quote-material-items">{selectedQuoteOrder.materialItems.map((item) => <small key={item.productId}>{item.productName}: {item.quantity} × {money(Number(item.unitSalePrice ?? item.unitCost))} = <b>{money(item.subtotal)}</b></small>)}</div> : null}</div>
              <div className="quote-values"><div><span>Material</span><b>{money(selectedQuoteOrder.materialCost)}</b></div><div><span>Mão de obra</span><b>{money(selectedQuoteOrder.laborCost)}</b></div><div className="quote-total"><span>Total</span><b>{money(Number(selectedQuoteOrder.materialCost) + Number(selectedQuoteOrder.laborCost))}</b></div></div>
              <small>Pagamento à vista via Pix ou dinheiro. Parcelamento sujeito às taxas da maquininha.</small>
            </>}</div>
          </div>}

          {tab === "fechamento" && <div className="closing-page">
            <div className="closing-toolbar admin-card"><div><h2>Fechamento do mês</h2><p className="admin-muted">Resultado em regime de caixa: serviços entregues + vendas confirmadas no mês, menos compras de materiais e custos operacionais lançados.</p></div><label><span>Mês de referência</span><input type="month" value={closingMonth} onChange={(e) => setClosingMonth(e.target.value)} /></label></div>

            <div className="admin-kpis closing-kpis">
              <article><span>Serviços entregues</span><strong>{monthOrders.length}</strong></article>
              <article><span>Mão de obra faturada</span><strong>{money(monthLaborRevenue)}</strong></article>
              <article><span>Materiais faturados</span><strong>{money(monthMaterialRevenue)}</strong></article>
              <article><span>Serviços faturados</span><strong>{money(monthRevenue)}</strong></article><article><span>Vendas da loja</span><strong>{money(monthStoreRevenue)}</strong><small>Lucro bruto {money(monthStoreProfit)}</small></article><article><span>Faturamento total</span><strong>{money(monthTotalRevenue)}</strong></article>
              <article><span>Compras de materiais</span><strong className="negative-value">- {money(monthPurchaseCost)}</strong></article>
              <article><span>Custos operacionais</span><strong className="negative-value">- {money(monthOperatingCost)}</strong></article>
              <article className="profit-kpi"><span>Lucro líquido (caixa)</span><strong className={monthNetProfit >= 0 ? "positive-value" : "negative-value"}>{money(monthNetProfit)}</strong><small>Margem {monthTotalRevenue > 0 ? `${((monthNetProfit / monthTotalRevenue) * 100).toFixed(1)}%` : "0%"}</small></article>
            </div>

            <div className="admin-two-cols closing-layout">
              <form className="admin-card admin-form" onSubmit={addExpense}>
                <h2>Adicionar custo do mês</h2>
                <div className="admin-form-row"><label><span>Categoria *</span><select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}><option>Energia</option><option>Água</option><option>Aluguel</option><option>Internet</option><option>Telefone</option><option>Impostos</option><option>Combustível</option><option>Ferramentas</option><option>Manutenção</option><option>Contabilidade</option><option>Outros</option></select></label><label><span>Data *</span><input type="date" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })} required /></label></div>
                <label><span>Descrição *</span><input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} placeholder="Ex.: Conta de energia da oficina" required /></label>
                <label><span>Valor (R$) *</span><input type="number" min="0" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required /></label>
                <button className="admin-primary">Cadastrar custo</button>
              </form>

              <div className="admin-card"><h2>Custos operacionais</h2><div className="admin-list expense-list">{monthExpenses.length === 0 ? <p className="admin-muted">Nenhum custo operacional lançado neste mês.</p> : monthExpenses.map((expense) => <article key={expense.id}><div className="expense-line"><div><b>{expense.category}</b><span>{expense.description} • {dateBR(expense.expenseDate)}</span></div><strong>{money(expense.amount)}</strong><button type="button" className="danger-icon" onClick={() => removeExpense(expense.id)}><Trash2 size={15} /></button></div></article>)}</div></div>
            </div>

            <div className="admin-card closing-section"><h2>Serviços entregues no mês</h2><OrderTable orders={monthOrders} customerName={customerName} vehicleName={vehicleName} onStatus={updateStatus} onCopy={copyLink} onEdit={editOrder} onDelete={removeOrder} /></div>
            <div className="admin-card closing-section"><h2>Vendas da loja no mês</h2><div className="admin-list purchase-list">{monthStoreOrders.length === 0 ? <p className="admin-muted">Nenhuma venda da loja confirmada neste mês.</p> : monthStoreOrders.map((order) => <article key={order.id}><div className="purchase-line"><div><b>{order.customerName}</b><span>{dateBR(order.confirmedAt || order.orderDate)} • Pedido #{order.id.slice(0, 8).toUpperCase()}</span></div><strong>{money(order.totalAmount)}</strong></div><small>{order.items?.map((item) => `${item.productName} (${item.quantity})`).join(", ")}</small><div className="sale-profit inline"><span>Custo {money(Number(order.costAmount || 0))}</span><strong>Lucro bruto {money(Number(order.profitAmount || 0))}</strong></div></article>)}</div></div>
            <div className="admin-card closing-section"><h2>Compras de materiais do mês</h2><div className="admin-list purchase-list">{monthPurchases.length === 0 ? <p className="admin-muted">Nenhuma compra de material neste mês.</p> : monthPurchases.map((p) => <article key={p.id}><div className="purchase-line"><div><b>{p.supplier}</b><span>{dateBR(p.purchaseDate)} {p.invoiceNumber ? `• NF ${p.invoiceNumber}` : ""}</span></div><strong>{money(p.totalAmount)}</strong></div><small>{p.items?.map((item) => `${item.productName} (${item.quantity})`).join(", ") || p.products || "Produtos não detalhados"}</small></article>)}</div></div>
          </div>}

          {tab === "agenda" && <OfficeCalendar orders={orders} customers={customers} vehicles={vehicles} />}
        </>}
        </div>
        </div>
      </section>
    </main>
  );
}

function OrderTable({
  orders,
  customerName,
  vehicleName,
  onStatus,
  onCopy,
  onEdit,
  onDelete,
}: {
  orders: ServiceOrder[];
  customerName: (id: string) => string;
  vehicleName: (id: string) => string;
  onStatus: (order: ServiceOrder, status: ServiceStatus) => void;
  onCopy: (token: string) => void;
  onEdit: (order: ServiceOrder) => void;
  onDelete: (order: ServiceOrder) => void;
}) {
  return <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Cliente / veículo</th><th>Serviço</th><th>Agenda</th><th>Valores</th><th>Status</th><th>Cliente</th><th>Ações</th></tr></thead><tbody>{orders.length === 0 ? <tr><td colSpan={7}>Nenhum serviço cadastrado.</td></tr> : orders.map((o) => <tr key={o.id}><td><b>{customerName(o.customerId)}</b><small>{vehicleName(o.vehicleId)}</small></td><td>{o.serviceDescription}</td><td><b>{dateBR(o.scheduledDate)}</b><small>Entrega: {dateBR(o.estimatedDelivery)}</small></td><td><b>{money(Number(o.materialCost) + Number(o.laborCost))}</b><small>Material {money(Number(o.materialCost))} • M.O. {money(Number(o.laborCost))}</small></td><td><select value={o.status} onChange={(e) => onStatus(o, e.target.value as ServiceStatus)}>{SERVICE_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></td><td><button className="copy-link" onClick={() => onCopy(o.publicToken)}><Copy size={15} /> Copiar link</button></td><td><div className="table-actions"><button type="button" className="edit-icon" onClick={() => onEdit(o)} title="Editar serviço"><Pencil size={15} /></button><button type="button" className="danger-icon" onClick={() => onDelete(o)} title="Excluir serviço"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>;
}
