const path = require('node:path');
const Module = require('node:module');
const React = require('react');
require('./register-ts.cjs');
const root = path.resolve(__dirname, '..');
function walk(node, predicate) {
  if (!node || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(n => walk(n, predicate));
  if (typeof node !== 'object') return [];
  const tag={AdminInput:'input',AdminSelect:'select',AdminTextarea:'textarea',AdminButton:'button'}[node.type?.name];
  if(tag){const field={...node,type:tag};node=node.props.label?{type:'label',props:{children:[node.props.label,field]}}:field;}
  if(node.props?.component==='form')node={...node,type:'form'};
  return [...(predicate(node) ? [node] : []), ...walk(node.props?.children, predicate)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join(' ');
  if (typeof node === 'object') return text(node.props?.label)+text(node.props?.children);
  return String(node);
}
const normalized = n => text(n).replace(/\s+/g, ' ').trim();
function fixture() {
  return {
    customers: [{ id:'c1', name:'Cliente Teste', phone:'3400000000' }],
    vehicles: [{ id:'v1', customerId:'c1', plate:'ABC1D23', brand:'Fiat', model:'Uno' }],
    serviceOrders: [{
      id:'o1', customerId:'c1', vehicleId:'v1', serviceDescription:'Pintura do para-choque',
      materialCost:24, materialRealCost:20, materialItems:[{
        productId:'p1', productName:'Tinta de teste', quantity:2, unitCost:10,
        unitSalePrice:12, markupPercent:20, costSubtotal:20, subtotal:24
      }], laborCost:150, scheduledDate:'2026-11-01', estimatedDelivery:'2026-11-12',
      status:'Em pintura', paymentStatus:'Pago', paidAt:'2026-11-05', paidAmount:174, publicToken:'test-token'
    }],
    products:[{ id:'p1', name:'Tinta de teste', stockCurrent:1, avgUnitCost:10, defaultMarkupPercent:20, unit:'L' }],
    purchaseOrders:[], operatingExpenses:[], storeCatalog:[], storeOrders:[]
  };
}
async function createAdminHarness(data = fixture()) {
  const values = [], effectDeps = [], writes = [], prints = [], pending = [];
  let index=0, nextId=1;
  const router={ replace(){} };
  const oldWindow=global.window;
  global.window={
    scrollTo(){}, confirm(){return true;},
    location:{origin:'https://test.invalid'},
    open(){return {document:{open(){},write(html){prints.push(html);},close(){}}};}
  };
  const react={
    ...React,
    useState(initial) {
      const i=index++;
      if (!(i in values)) values[i]=typeof initial==='function'?initial():initial;
      return [values[i], next=>{values[i]=typeof next==='function'?next(values[i]):next;}];
    },
    useMemo(fn){return fn();},
    useEffect(fn,deps){
      const i=index++;
      if (!effectDeps[i] || !deps || deps.some((d,j)=>!Object.is(d,effectDeps[i][j]))) {
        effectDeps[i]=deps; pending.push(fn);
      }
    }
  };
  function apply(type, ref, payload) {
    writes.push({type,ref,payload});
    const list=data[ref.collection] ||= [];
    const at=list.findIndex(d=>d.id===ref.id);
    if(type==='delete'){if(at>=0)list.splice(at,1);return;}
    const prior=at>=0?list[at]:{id:ref.id};
    const resolved={};
    for(const [k,v] of Object.entries(payload))resolved[k]=v && typeof v==='object' && '__increment' in v
      ?Number(prior[k]||0)+v.__increment:v;
    const updated={...prior,...resolved};
    if(at>=0)list[at]=updated;else list.push(updated);
  }
  const firestore={
    collection(_db,name){return {collection:name};},
    doc(first,second,third){
      return third!==undefined?{collection:second,id:third}
        :first?.collection?{collection:first.collection,id:second||'new-'+nextId++}
        :{collection:second,id:'new-'+nextId++};
    },
    query(ref){return ref;}, orderBy(){return {};},
    async getDocs(ref){return {docs:(data[ref.collection]||[]).map(d=>({id:d.id,data:()=>({...d})}))};},
    serverTimestamp(){return 'test-server-time';}, increment(n){return {__increment:n};},
    async updateDoc(ref,payload){apply('update',ref,payload);},
    async setDoc(ref,payload){apply('set',ref,payload);},
    async deleteDoc(ref){apply('delete',ref,{});},
    async addDoc(ref,payload){const added={...ref,id:'new-'+nextId++};apply('set',added,payload);return added;},
    writeBatch(){
      const ops=[];
      return {set:(ref,payload)=>ops.push(['set',ref,payload]),update:(ref,payload)=>ops.push(['update',ref,payload]),delete:ref=>ops.push(['delete',ref,{}]),
        async commit(){for(const args of ops)apply(...args);}};
    }
  };
  const originalLoad=Module._load;
  for(const key of Object.keys(require.cache)) {
    if(key.startsWith(root+path.sep) && !key.includes('node_modules') &&
      (key.includes(path.sep+'app'+path.sep)||key.includes(path.sep+'components'+path.sep)||key.includes(path.sep+'lib'+path.sep))) delete require.cache[key];
  }
  Module._load=function(request,parent,isMain){
    if(request==='react')return react;
    if(request==='firebase/firestore')return firestore;
    if(request==='firebase/auth')return {onAuthStateChanged(_auth,cb){cb({uid:'test'});return ()=>{};},signOut:async()=>{}};
    if(request==='next/navigation')return {useRouter:()=>router};
    if(request==='@/lib/firebase'||request.endsWith('/lib/firebase'))return {auth:{},db:{}};
    if(request==='lucide-react')return new Proxy({}, {get:(_,key)=>key==='__esModule'?true:()=>null});
    return originalLoad.apply(this,arguments);
  };
  let Admin;
  try {Admin=require('../app/admin/page.tsx').default;} finally {Module._load=originalLoad;}
  const render=()=>{index=0;return Admin();};
  async function settle() {
    for(let i=0;i<6;i++){
      while(pending.length)pending.shift()();
      await new Promise(resolve=>setImmediate(resolve));
    }
    return render();
  }
  render(); await settle();
  return {
    data,writes,prints,render,settle,walk,text,normalized,
    find(type,pattern,tree=render()) {
      return walk(tree,n=>n.type===type && pattern.test(normalized(n)))[0];
    },
    field(label, type='input',tree=render()){
      const outer=walk(tree,n=>n.type==='label'&&label.test(normalized(n)))[0];
      return outer && walk(outer,n=>n.type===type)[0];
    },
    async click(pattern){
      const button=this.find('button',pattern);
      if(!button)throw new Error('Botão ausente: '+pattern);
      if(button.props.disabled)throw new Error('Botão desabilitado: '+pattern);
      await button.props.onClick(); return settle();
    },
    change(field,value){if(!field)throw new Error('Campo ausente');field.props.onChange({target:{value}});},
    dispose(){global.window=oldWindow;}
  };
}
module.exports={createAdminHarness,fixture,walk,text,normalized};

