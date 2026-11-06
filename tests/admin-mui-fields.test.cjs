const test=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');const Module=require('node:module');
const {load}=require('./register-ts.cjs');
function fields(){const path=require.resolve('../components/admin/ui/AdminFields.tsx');delete require.cache[path];const original=Module._load;Module._load=function(name,parent,...rest){if(name==='react'&&parent?.filename===path)return {...React,useId:()=> 'field-id',useState:v=>[v,()=>{}],useRef:v=>({current:v}),useEffect:()=>{}};return original.call(this,name,parent,...rest);};try{return load('components/admin/ui/AdminFields.tsx');}finally{Module._load=original;delete require.cache[path];}}
test('máscara monetária apresenta centavos e entrega valor numérico sem separadores aos cálculos',()=>{
 const {AdminInput}=fields();let received;const element=AdminInput({mask:'currency',value:'1234.56',min:'0',onChange:e=>received=e.target.value});
 assert.equal(element.props.decimalSeparator,',');assert.equal(element.props.decimalScale,2);assert.equal(element.props.fixedDecimalScale,true);
 element.props.onValueChange({value:'1234.56',floatValue:1234.56},{source:'event'});assert.equal(received,'1234.56');
 element.props.onValueChange({value:'99',floatValue:99},{source:'prop'});assert.equal(received,'1234.56');
});
test('telefone, CPF e CNPJ formatam sem limitar a transição para documento maior',()=>{
 const {AdminInput}=fields();let value;
 const phone=AdminInput({mask:'phone',value:'34991543776',onChange:e=>value=e.target.value});assert.equal(phone.props.value,'(34) 99154-3776');phone.props.onChange({target:{value:'(34) 99154-3776'}});assert.equal(value,'34991543776');
 assert.equal(AdminInput({mask:'document',value:'12345678901'}).props.value,'123.456.789-01');
 const doc=AdminInput({mask:'document',value:'12345678000199',onChange:e=>value=e.target.value});assert.equal(doc.props.value,'12.345.678/0001-99');doc.props.onChange({target:{value:'12.345.678/0001-99'}});assert.equal(value,'12345678000199');
});
test('date picker preserva ISO local e invalida datas incompletas; mês envia somente ano-mês',()=>{
 const {AdminInput}=fields();const dayjs=require('dayjs');let value;
 const calendar=AdminInput({type:'date',value:'2026-11-15',required:true,onChange:e=>value=e.target.value});const picker=calendar.type(calendar.props);
 assert.equal(picker.props.format,'DD/MM/YYYY');picker.props.onChange(dayjs('2026-11-15'),{validationError:null});assert.equal(value,'2026-11-15');
 picker.props.onChange(dayjs('invalid'),{validationError:'invalidDate'});assert.equal(value,'');assert.equal(picker.props.slotProps.textField.required,true);
 const month=AdminInput({type:'month',value:'2026-11',onChange:e=>value=e.target.value});month.type(month.props).props.onChange(dayjs('2026-10-01'),{validationError:null});assert.equal(value,'2026-10');
});
test('seleções sem value explícito conservam Pix, Dinheiro e outras opções existentes',()=>{
 const {AdminSelect}=fields();const select=AdminSelect({value:'Pix',children:[React.createElement('option',{key:'pix'},'Pix'),React.createElement('option',{key:'id',value:'p1'},'Tinta')]});
 assert.equal(select.props.children[0].props.value,'Pix');assert.equal(select.props.children[1].props.value,'p1');
});
test('placa normaliza formato antigo e Mercosul; readonly permanece no campo',()=>{
 const {AdminInput}=fields();let value;const field=AdminInput({mask:'plate',value:'',onChange:e=>value=e.target.value});field.props.onChange({target:{value:'abc-1d23'}});assert.equal(value,'ABC1D23');
 const readonly=AdminInput({value:'R$ 20,00',readOnly:true});assert.equal(readonly.props.slotProps.htmlInput.readOnly,true);assert.equal(readonly.props.id,'field-id');assert.equal('id' in readonly.props.slotProps.htmlInput,false);
});
