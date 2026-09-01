"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { ServiceOrder, Customer, Vehicle } from "@/lib/office-types";

interface Props { orders: ServiceOrder[]; customers: Customer[]; vehicles: Vehicle[]; }

export default function OfficeCalendar({ orders, customers, vehicles }: Props) {
  const [cursor, setCursor] = useState(() => new Date());
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = useMemo(() => {
    const arr: Array<Date | null> = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) arr.push(new Date(year, month, d));
    while (arr.length % 7) arr.push(null);
    return arr;
  }, [year, month, first.getDay(), last.getDate()]);

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const customerName = (id: string) => customers.find(c => c.id === id)?.name || "Cliente";
  const vehicleName = (id: string) => {
    const v = vehicles.find(x => x.id === id);
    return v ? `${v.brand} ${v.model} • ${v.plate}` : "Veículo";
  };

  return <div className="calendar-card">
    <div className="calendar-toolbar">
      <button onClick={()=>setCursor(new Date(year, month-1, 1))}><ChevronLeft size={18}/></button>
      <strong>{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong>
      <button onClick={()=>setCursor(new Date(year, month+1, 1))}><ChevronRight size={18}/></button>
    </div>
    <div className="calendar-grid calendar-week"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div>
    <div className="calendar-grid">
      {days.map((date, index) => {
        if (!date) return <div key={index} className="calendar-day empty" />;
        const list = orders.filter(o => o.scheduledDate === fmt(date));
        return <div key={index} className="calendar-day">
          <span className="calendar-number">{date.getDate()}</span>
          <div className="calendar-orders">{list.map(o => <div key={o.id} className="calendar-event"><b>{customerName(o.customerId)}</b><small>{vehicleName(o.vehicleId)}</small><em>{o.status}</em></div>)}</div>
        </div>;
      })}
    </div>
  </div>;
}
