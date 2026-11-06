const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./register-ts.cjs');

function order(overrides={}) {
  return {
    id:'o1',customerId:'c1',vehicleId:'v1',serviceDescription:'Serviço novembro',
    materialCost:100,materialRealCost:100,materialItems:[],
    laborCost:900,scheduledDate:'2026-11-01',estimatedDelivery:'2026-11-12',
    status:'Em pintura',paymentStatus:'Pago',paidAt:'2026-11-05',
    publicToken:'teste',...overrides,
  };
}
const customers=[
  {id:'c1',name:'Cliente Novembro',phone:'3400000000'},
  {id:'c2',name:'Outro Novembro',phone:'3400000001'},
  {id:'c3',name:'Cliente ForaMes',phone:'3400000002'},
  {id:'c4',name:'Cliente Parcial',phone:'3400000003'},
  {id:'c5',name:'Cliente SemData',phone:'3400000004'},
];
const vehicles=[{id:'v1',customerId:'c1',plate:'ABC1D23',brand:'Fiat',model:'Uno'}];
function render(file,props) {
  const Component=load(file).default;
  const {LocalizationProvider}=require('@mui/x-date-pickers/LocalizationProvider');
  const {AdapterDayjs}=require('@mui/x-date-pickers/AdapterDayjs');
  const html=renderToStaticMarkup(React.createElement(LocalizationProvider,{dateAdapter:AdapterDayjs},React.createElement(Component,props)));
  return {html,text:html.replace(/<[^>]+>/g,' ').replace(/&nbsp;|\u00a0/g,' ').replace(/\s+/g,' ')};
}
test('TEST-UI-RENDER-01 REQ-02 custo interno mostra materiais, rateio, total e resultado reais',()=>{
  const {html,text}=render('components/admin/InternalServiceCost.tsx',{order:order()});
  for(const value of ['100,00','396,00','496,00','504,00'])assert.ok(text.includes(value),'valor interno '+value);
  assert.match(html,/internal-cost-panel/,'painel identificável para ocultação na impressão');
});
test('TEST-UI-RENDER-02 REQ-02 custo ausente não vira zero ou resultado completo',()=>{
  const missing=order({materialRealCost:undefined,materialItems:undefined});
  const {text}=render('components/admin/InternalServiceCost.tsx',{order:missing});
  assert.match(text,/não informado|não disponível|indisponível|ausente|desconhecido|incompleto/i);
  assert.doesNotMatch(text,/604,00/,'não apresentar resultado supondo materiais zero');
});
test('TEST-UI-RENDER-03 REQ-04/05 relatório SSR mostra rateio somente de totalmente pagos no mês escolhido',()=>{
  const orders=[
    order({materialRealCost:20}),
    order({id:'o2',customerId:'c2',materialRealCost:30,status:'Agendado'}),
    order({id:'o3',customerId:'c3',paidAt:'2026-10-05'}),
    order({id:'o4',customerId:'c4',paymentStatus:'Pago parcial',paidAmount:200}),
  ];
  const {text}=render('components/admin/ServiceCostReport.tsx',{orders,customers,vehicles,initialMonth:'2026-11'});
  assert.match(text,/Cliente Novembro/);
  assert.match(text,/Outro Novembro/,'não exigir entrega');
  assert.doesNotMatch(text,/Cliente ForaMes/);
  assert.doesNotMatch(text,/Cliente Parcial/,'parcial não entra nas linhas rateadas');
  for(const value of ['6.392,00','40,00','50,00','2.000,00','6.482,00','4.482,00']) {
    assert.ok(text.includes(value),'total esperado '+value);
  }
});
test('TEST-UI-RENDER-04 REQ-04 relatório informa ausência de data e custo sem inventar resultado',()=>{
  const orders=[
    order({materialRealCost:undefined,materialItems:undefined}),
    order({id:'o5',customerId:'c5',paidAt:undefined}),
  ];
  const {text}=render('components/admin/ServiceCostReport.tsx',{orders,customers,vehicles,initialMonth:'2026-11'});
  assert.match(text,/Cliente Novembro/);
  assert.match(text,/sem data|data[^.]*ausente|data[^.]*inválida/i);
  assert.match(text,/não informado|não disponível|indisponível|ausente|desconhecido|incompleto/i);
  assert.doesNotMatch(text,/5.412,00/,'resultado não presume zero para materiais desconhecidos');
});
test('TEST-UI-RENDER-05 REQ-04 relatório vazio mantém custo fixo não rateado e não divide por zero',()=>{
  const {text}=render('components/admin/ServiceCostReport.tsx',{orders:[],customers,vehicles,initialMonth:'2026-11'});
  assert.match(text,/nenhum|sem serviços|sem pagamentos/i);
  assert.ok(text.includes('6.392,00'));
  assert.doesNotMatch(text,/NaN|Infinity|Infinito/);
});

