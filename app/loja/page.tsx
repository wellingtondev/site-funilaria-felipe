"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";
import { Minus, Plus, ShoppingBag, ShoppingCart, Tag, X } from "lucide-react";
import { db } from "@/lib/firebase";
import type { StoreCatalogProduct } from "@/lib/office-types";

const WHATSAPP = "5534991543776";
const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const todayLocal = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type Cart = Record<string, number>;

export default function StorePage() {
  const [products, setProducts] = useState<StoreCatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("Todos");
  const [cart, setCart] = useState<Cart>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    async function loadStore() {
      try {
        const snap = await getDocs(collection(db, "storeCatalog"));
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as StoreCatalogProduct))
          .filter((item) => item.active && Number(item.stockCurrent || 0) > 0 && Number(item.salePrice || 0) > 0)
          .sort((a, b) => {
            const promoDiff = Number(Boolean(b.promotionEnabled)) - Number(Boolean(a.promotionEnabled));
            return promoDiff || a.name.localeCompare(b.name, "pt-BR");
          });
        setProducts(data);
      } finally {
        setLoading(false);
      }
    }
    loadStore();
  }, []);

  const categories = useMemo(() => {
    const values = Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])).sort();
    return ["Todos", ...values];
  }, [products]);

  const filtered = category === "Todos" ? products : products.filter((p) => p.category === category);

  function currentPrice(product: StoreCatalogProduct) {
    return product.promotionEnabled && Number(product.promotionPrice || 0) > 0
      ? Number(product.promotionPrice)
      : Number(product.salePrice || 0);
  }

  function add(product: StoreCatalogProduct) {
    setCart((current) => {
      const quantity = current[product.id] || 0;
      const max = Math.max(0, Math.floor(Number(product.stockCurrent || 0)));
      if (quantity >= max) return current;
      return { ...current, [product.id]: quantity + 1 };
    });
  }

  function remove(productId: string) {
    setCart((current) => {
      const quantity = current[productId] || 0;
      if (quantity <= 1) {
        const copy = { ...current };
        delete copy[productId];
        return copy;
      }
      return { ...current, [productId]: quantity - 1 };
    });
  }

  const cartItems = products
    .filter((p) => cart[p.id])
    .map((product) => ({ product, quantity: cart[product.id], price: currentPrice(product) }));
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

  async function sendWhatsApp() {
    if (!cartItems.length || sending) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      setCheckoutError("Informe seu nome e WhatsApp para enviar o pedido.");
      return;
    }

    const whatsappWindow = window.open("about:blank", "_blank");
    setSending(true);
    setCheckoutError("");
    try {
      const orderDate = todayLocal();
      const orderRef = await addDoc(collection(db, "storeOrders"), {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        items: cartItems.map(({ product, quantity, price }) => ({
          productId: product.productId || product.id,
          productName: product.name,
          quantity,
          unitPrice: price,
          subtotal: quantity * price,
        })),
        totalAmount: total,
        status: "Pendente",
        orderDate,
        createdAt: serverTimestamp(),
      });

      const shortId = orderRef.id.slice(0, 8).toUpperCase();
      const lines = [
        "Olá! Gostaria de confirmar um pedido na Felipe Auto Design:",
        `Pedido #${shortId}`,
        `Cliente: ${customerName.trim()}`,
        `WhatsApp: ${customerPhone.trim()}`,
        "",
        ...cartItems.map(({ product, quantity, price }) => `• ${quantity}x ${product.name} — ${money(price * quantity)}`),
        "",
        `Total estimado: ${money(total)}`,
        "",
        "Pode confirmar a disponibilidade e combinar a retirada/entrega?",
      ];
      const whatsappUrl = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(lines.join("\n"))}`;
      if (whatsappWindow) {
        whatsappWindow.opener = null;
        whatsappWindow.location.href = whatsappUrl;
      } else {
        window.location.href = whatsappUrl;
      }
      setCart({});
      setCartOpen(false);
    } catch (error) {
      console.error(error);
      whatsappWindow?.close();
      setCheckoutError("Não foi possível registrar o pedido. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="store-page">
      <section className="store-hero">
        <div className="container store-hero-inner">
          <div>
            <span className="eyebrow">LOJA FELIPE AUTO DESIGN</span>
            <h1>Produtos para cuidar do seu carro.</h1>
            <p>Escolha os produtos disponíveis em estoque e envie seu pedido direto pelo WhatsApp.</p>
          </div>
          <button className="store-cart-button" onClick={() => setCartOpen(true)}>
            <ShoppingCart size={20} /> Carrinho <b>{cartCount}</b>
          </button>
        </div>
      </section>

      <section className="section store-section">
        <div className="container">
          {categories.length > 1 && (
            <div className="store-filters">
              {categories.map((item) => (
                <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="store-empty"><ShoppingBag size={34} /><p>Carregando produtos...</p></div>
          ) : filtered.length === 0 ? (
            <div className="store-empty"><ShoppingBag size={34} /><h2>Nenhum produto disponível agora.</h2><p>Novos itens serão exibidos aqui assim que entrarem no estoque.</p></div>
          ) : (
            <div className="store-grid">
              {filtered.map((product) => {
                const promo = product.promotionEnabled && Number(product.promotionPrice || 0) > 0;
                const price = currentPrice(product);
                const qty = cart[product.id] || 0;
                return (
                  <article className={promo ? "store-card promo" : "store-card"} key={product.id}>
                    <div className="store-card-image">
                      {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <div className="store-image-placeholder"><ShoppingBag size={48} /></div>}
                      {promo && <span className="promo-badge"><Tag size={14} /> {product.promotionLabel || "Oferta"}</span>}
                    </div>
                    <div className="store-card-body">
                      <span className="store-category">{product.category || "Produto automotivo"}</span>
                      <h2>{product.name}</h2>
                      <div className="store-stock">Em estoque: {Number(product.stockCurrent || 0).toLocaleString("pt-BR")} {product.unit || "un"}</div>
                      <div className="store-price">
                        {promo && <small>{money(product.salePrice)}</small>}
                        <strong>{money(price)}</strong>
                      </div>
                      {qty === 0 ? (
                        <button className="btn primary store-add" onClick={() => add(product)}><Plus size={17} /> Adicionar ao pedido</button>
                      ) : (
                        <div className="store-qty">
                          <button onClick={() => remove(product.id)} aria-label="Diminuir quantidade"><Minus size={16} /></button>
                          <span>{qty}</span>
                          <button onClick={() => add(product)} disabled={qty >= Math.floor(Number(product.stockCurrent || 0))} aria-label="Aumentar quantidade"><Plus size={16} /></button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {cartCount > 0 && <button className="store-floating-cart" onClick={() => setCartOpen(true)}><ShoppingCart size={19} /><span>Ver pedido ({cartCount})</span><b>{money(total)}</b></button>}

      {cartOpen && (
        <div className="store-cart-overlay" onClick={() => setCartOpen(false)}>
          <aside className="store-cart-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="store-cart-head"><div><span>SEU PEDIDO</span><h2>Carrinho</h2></div><button onClick={() => setCartOpen(false)}><X /></button></div>
            <div className="store-cart-items">
              {cartItems.length === 0 ? <p className="admin-muted">Seu carrinho está vazio.</p> : cartItems.map(({ product, quantity, price }) => (
                <div className="store-cart-item" key={product.id}>
                  <div><b>{product.name}</b><span>{money(price)} cada</span></div>
                  <div className="store-cart-item-actions"><button onClick={() => remove(product.id)}><Minus size={14} /></button><span>{quantity}</span><button onClick={() => add(product)}><Plus size={14} /></button></div>
                  <strong>{money(price * quantity)}</strong>
                </div>
              ))}
            </div>
            <div className="store-cart-footer">
              <div><span>Total estimado</span><strong>{money(total)}</strong></div>
              <div className="store-customer-fields">
                <label><span>Seu nome *</span><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome para o pedido" /></label>
                <label><span>Seu WhatsApp *</span><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(34) 99999-9999" /></label>
              </div>
              {checkoutError && <div className="store-checkout-error">{checkoutError}</div>}
              <button className="store-whatsapp" onClick={sendWhatsApp} disabled={!cartItems.length || sending}>{sending ? "Registrando pedido..." : "Enviar pedido pelo WhatsApp"}</button>
              <small>O pedido ficará pendente até a confirmação da oficina. O estoque só é baixado quando a venda for confirmada.</small>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
