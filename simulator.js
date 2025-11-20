(function(){
  const CELLS = 100;
  document.getElementById('totalCells').innerText = CELLS;
  let memory = new Array(CELLS).fill(null); 
  let procCounter = 1;

  // Biến thống kê
  let success = 0;
  let fail = 0;
  let allocCount = 0; 
  let procSizes = [];

  const memDiv = document.getElementById('memory');
  const COLORS = [
    "#e74c3c","#9b59b6","#f39c12","#1abc9c","#3498db",
    "#2ecc71","#d35400","#7f8c8d","#16a085","#c0392b",
    "#8e44ad","#27ae60","#2980b9","#f1c40f","#34495e"
  ];
  function getColor(id){ 
    const num = parseInt(id.replace("proc-","")); 
    return COLORS[(num-1)%COLORS.length]; 
  }

  function render(){
    memDiv.innerHTML='';
    for(let i=0;i<CELLS;i++){
      const c=document.createElement('div');
      if(memory[i]){
        const id=memory[i].id;
        c.className='cell';
        c.style.backgroundColor=getColor(id);
        c.title=id;
      } else c.className='cell hole';
      memDiv.appendChild(c);
    }
    updateStats();
    renderTable();
  }

  function calcHoles(){
    const holes=[]; let i=0;
    while(i<CELLS){
      if(!memory[i]){
        let j=i; while(j<CELLS && !memory[j]) j++;
        holes.push({start:i,size:j-i});
        i=j;
      } else i++;
    }
    return holes;
  }

  function renderTable(){
    const tbody=document.querySelector('#ptable tbody');
    tbody.innerHTML='';
    const procs={};
    for(let i=0;i<CELLS;i++){
      if(memory[i]){
        const id=memory[i].id;
        if(!procs[id]) procs[id]={id,start:i,size:0};
        procs[id].size++;
      }
    }
    Object.values(procs).sort((a,b)=>a.start-b.start).forEach(p=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${p.id}</td><td>${p.start}</td><td>${p.size}</td>`;
      tbody.appendChild(tr);
    });
  }

  function log(msg){
    const d=new Date().toLocaleTimeString();
    document.getElementById('log').innerHTML=`<div>[${d}] ${msg}</div>`+document.getElementById('log').innerHTML;
  }

  function allocate(size,strat){
    size=Math.max(1,Math.floor(size));
    allocCount++;
    const holes=calcHoles();
    let candidate=null;
    if(strat==='first') candidate=holes.find(h=>h.size>=size);
    else if(strat==='best') candidate=holes.filter(h=>h.size>=size).sort((a,b)=>a.size-b.size)[0];
    else if(strat==='worst') candidate=holes.filter(h=>h.size>=size).sort((a,b)=>b.size-a.size)[0];
    if(!candidate){ log(`Không tìm được hole đủ lớn cho kích thước ${size}`); fail++; return null; }
    const id='proc-'+(procCounter++);
    for(let i=0;i<size;i++) memory[candidate.start+i]={id};
    success++; procSizes.push(size);
    log(`Allocated ${id} size=${size} at ${candidate.start} (strategy=${strat})`);
    return id;
  }

  function freeById(id){
    let found=false;
    for(let i=0;i<CELLS;i++){
      if(memory[i] && memory[i].id===id){ memory[i]=null; found=true; }
    }
    if(found) log(`Freed ${id}`); else log(`Không tìm thấy ${id}`);
  }

  function compact(){
    const newMem=new Array(CELLS).fill(null);
    let write=0;
    for(let i=0;i<CELLS;i++){
      if(memory[i]){
        const id=memory[i].id;
        if(i===0 || memory[i-1]===null || memory[i-1].id!==id){
          let j=i; while(j<CELLS && memory[j] && memory[j].id===id) j++;
          const size=j-i;
          for(let k=0;k<size;k++) newMem[write+k]={id};
          write+=size;
        }
      }
    }
    memory=newMem;
    log('Compaction: dồn các tiến trình về trái');
    render();
  }

  function updateStats(){
    const used=memory.filter(x=>x).length;
    document.getElementById('usedCells').innerText=used;
    const holes=calcHoles();
    document.getElementById('holesCount').innerText=holes.length;
    const free=CELLS-used; let wasted=0;
    const avgNeed=procSizes.length ? procSizes.reduce((a,b)=>a+b,0)/procSizes.length : 0;
    holes.forEach(h=>{ if(h.size<avgNeed) wasted+=h.size; });
    document.getElementById('extFrag').innerText=free ? Math.round(100*wasted/free)+'%' : '0%';
    document.getElementById('allocCount').innerText=allocCount;
    document.getElementById('successCount').innerText=success;
    const totalOps=success+fail;
    const rate=totalOps ? (success/totalOps*100).toFixed(1) : 0;
    document.getElementById('successRate').innerText=rate+'%';
    document.getElementById('avgNeed').innerText=avgNeed.toFixed(1);
  }

  function resetStats(){
    success=0; fail=0; allocCount=0; procSizes=[];
    document.getElementById('usedCells').innerText=0;
    document.getElementById('holesCount').innerText=0;
    document.getElementById('extFrag').innerText='0%';
    document.getElementById('successRate').innerText='0%';
    document.getElementById('allocCount').innerText=0;
    document.getElementById('successCount').innerText=0;
    document.getElementById('avgNeed').innerText=0;
  }

  // init render
  render();

  // hooks
  document.getElementById('alloc').onclick=()=>{
    const size=Number(document.getElementById('size').value)||1;
    const strat=document.getElementById('strategy').value;
    const id=allocate(size,strat);
    render();
    if(id) document.getElementById('freeId').value=id;
  };
  document.getElementById('free').onclick=()=>{
    const id=document.getElementById('freeId').value.trim();
    if(!id){ alert('Nhập ID để free (ví dụ proc-1)'); return; }
    freeById(id); render();
  };
  document.getElementById('random').onclick=()=>{
    for(let t=0;t<12;t++){
      if(Math.random()<0.6){
        const size=Math.floor(Math.random()*12)+1;
        allocate(size,['first','best','worst'][Math.floor(Math.random()*3)]);
      } else {
        const ids=Array.from(new Set(memory.filter(x=>x).map(x=>x.id)));
        if(ids.length) freeById(ids[Math.floor(Math.random()*ids.length)]);
      }
    }
    render();
  };
  document.getElementById('compact').onclick=()=>compact();
  document.getElementById('reset').onclick=()=>{
    resetStats();
    memory=new Array(CELLS).fill(null);
    procCounter=1;
    render();
  };

})();
