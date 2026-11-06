"use client";
import { Children, Fragment, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type ReactElement, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes, type ChangeEvent } from "react";
import { Button, Checkbox, MenuItem, TextField, Tooltip, IconButton, InputAdornment } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { Eye, EyeOff } from "lucide-react";
import dayjs, { type Dayjs } from "dayjs";
import { NumericFormat } from "react-number-format";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; mask?: "currency" | "phone" | "document" | "plate" | "year" | "decimal" | "percent" };
const changed = (value: string, name?: string) => ({ target: { value, name }, currentTarget: { value, name } } as ChangeEvent<HTMLInputElement>);
function CalendarInput({ value, onChange, label, type, required, disabled, name, min, max, id }: InputProps) {
  const raw = String(value ?? "");
  const [draft,setDraft] = useState<Dayjs|null>(raw ? dayjs(raw.length===7 ? raw+"-01" : raw) : null);
  const lastSent = useRef(raw);
  useEffect(()=>{if(raw!==lastSent.current){setDraft(raw ? dayjs(raw.length===7 ? raw+"-01" : raw) : null);lastSent.current=raw;}},[raw]);
  return <DatePicker label={label} value={draft} disabled={disabled} views={type==="month" ? ["year","month"] : ["year","month","day"]} format={type==="month" ? "MM/YYYY" : "DD/MM/YYYY"} minDate={min ? dayjs(String(min)) : undefined} maxDate={max ? dayjs(String(max)) : undefined} onChange={(date,context)=>{setDraft(date);const next=date?.isValid() && !context.validationError ? date.format(type==="month" ? "YYYY-MM" : "YYYY-MM-DD") : "";lastSent.current=next;onChange?.(changed(next,name));}} dayOfWeekFormatter={date=>["D","S","T","Q","Q","S","S"][date.day()]} slotProps={{textField:{id,name,required,fullWidth:true,size:"small",helperText:draft&&!draft.isValid()?"Informe uma data vÃ¡lida":undefined},actionBar:{actions:["clear","today","cancel","accept"]}}}/>;
}
export function AdminInput(props: InputProps) {
  const generated = useId();
  const [showPassword,setShowPassword] = useState(false);
  const { label, mask, type, onChange, value, onBlur, className, style, ...rest } = props;
  const id=props.id||generated;
  if(type==="date"||type==="month")return <CalendarInput {...props} id={id}/>;
  if(type==="checkbox")return <Checkbox checked={props.checked} disabled={props.disabled} onChange={onChange} name={props.name} slotProps={{input:{"aria-label":String(label||props["aria-label"]||"Ativar")}}}/>;
  const common={id,label,fullWidth:true,size:"small" as const,required:props.required,disabled:props.disabled,name:props.name,placeholder:props.placeholder,className,style,autoFocus:props.autoFocus,autoComplete:props.autoComplete,onBlur};
  if(mask==="currency"||mask==="decimal"||mask==="percent"||type==="number")return <NumericFormat {...common} customInput={TextField} value={value as string|number|undefined} valueIsNumericString decimalSeparator="," thousandSeparator="." decimalScale={mask==="currency"?2:mask==="percent"?2:6} fixedDecimalScale={mask==="currency"} allowNegative={props.min===undefined || Number(props.min)<0} prefix={mask==="currency"?"R$ ":undefined} suffix={mask==="percent"?" %":undefined} inputMode="decimal" onValueChange={(v,source)=>{if(source.source==="event"){
      const input=source.event?.target as HTMLInputElement|undefined;
      const number=v.floatValue;
      const invalid=number!==undefined && ((props.min!==undefined && number<Number(props.min)) || (props.max!==undefined && number>Number(props.max)));
      input?.setCustomValidity?.(invalid?"Informe um valor dentro do intervalo permitido.":"");
      onChange?.(changed(v.value,props.name));
    }}} slotProps={{htmlInput:{"aria-label":props["aria-label"],min:props.min,max:props.max,readOnly:props.readOnly}}}/>;
  if(mask==="phone"||mask==="document") {
    const digits=String(value??"").replace(/\D/g,"");
    const pattern=mask==="phone" ? (digits.length>10?"(##) #####-####":"(##) ####-####") : digits.length>11?"##.###.###/####-##":"###.###.###-##";
    let index=0;let formatted="";
    for(const char of pattern){if(index>=digits.length)break;formatted+=char==="#"?digits[index++]:char;}
    return <TextField {...common} value={formatted} onChange={e=>onChange?.(changed(e.target.value.replace(/\D/g,"").slice(0,mask==="phone"?11:14),props.name))} slotProps={{htmlInput:{inputMode:"numeric","aria-label":props["aria-label"]}}}/>;
  }
  return <TextField {...common} type={type==="password" && showPassword ? "text" : type||"text"} value={value??""} multiline={false} onChange={e=>{let v=e.target.value;if(mask==="plate")v=v.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,7);if(mask==="year")v=v.replace(/\D/g,"").slice(0,4);onChange?.(changed(v,props.name));}} slotProps={{input:type==="password" ? {endAdornment:<InputAdornment position="end"><IconButton type="button" aria-label={showPassword?"Ocultar senha":"Mostrar senha"} onClick={()=>setShowPassword(!showPassword)} edge="end">{showPassword?<EyeOff size={19}/>:<Eye size={19}/>}</IconButton></InputAdornment>} : undefined,htmlInput:{...rest,inputMode:mask==="year"?"numeric":props.inputMode}}}/>;
}
function options(children:ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap<ReactNode>(child=>{if(!isValidElement(child))return [];const el=child as ReactElement<{children?:ReactNode;value?:string|number;disabled?:boolean}>;if(el.type===Fragment)return options(el.props.children);return [<MenuItem key={el.key??String(el.props.value)} value={el.props.value??(typeof el.props.children==="string"?el.props.children:"")} disabled={el.props.disabled}>{el.props.children}</MenuItem>];});
}
export function AdminSelect({label,children,onChange,value,id,...props}:SelectHTMLAttributes<HTMLSelectElement>&{label?:ReactNode}) {
  const generated=useId();
  return <TextField id={id||generated} select label={label} value={value??""} fullWidth size="small" disabled={props.disabled} required={props.required} className={props.className} onChange={e=>onChange?.(e as unknown as ChangeEvent<HTMLSelectElement>)} slotProps={{select:{displayEmpty:!label,MenuProps:{slotProps:{paper:{sx:{maxHeight:360,maxWidth:"min(560px, 95vw)","& .MuiMenuItem-root":{whiteSpace:"normal",overflowWrap:"anywhere"}}}}}},htmlInput:{name:props.name,"aria-label":props["aria-label"]||props.title}}}>{options(children)}</TextField>;
}
export function AdminTextarea({label,onChange,...props}:TextareaHTMLAttributes<HTMLTextAreaElement>&{label?:ReactNode}) {
  const id=useId();return <TextField id={props.id||id} label={label} fullWidth size="small" multiline minRows={props.rows||3} value={props.value??""} required={props.required} disabled={props.disabled} placeholder={props.placeholder} name={props.name} className={props.className} onChange={e=>onChange?.(e as ChangeEvent<HTMLTextAreaElement>)}/>;
}
export function AdminButton({className="",children,title,type="submit",...props}:ButtonHTMLAttributes<HTMLButtonElement>) {
  const danger=className.includes("danger");const primary=className.includes("primary")||className==="active";
  const button=<Button {...props} type={type} className={className} aria-label={props["aria-label"]||title} variant={primary?"contained":className.includes("icon")?"text":"outlined"} color={danger?"error":"primary"} sx={{gap:1,minWidth:className.includes("icon")?36:undefined}}>{children}</Button>;
  return title?<Tooltip title={title}><span style={{display:"inline-flex"}}>{button}</span></Tooltip>:button;
}
