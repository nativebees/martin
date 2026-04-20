import { useState, useEffect, useCallback } from "react";

// ── Tax brackets ──────────────────────────────────────────────────────────────
const BRACKETS_2026 = [
  [24600,0.10],[99850,0.12],[213000,0.22],[406500,0.24],
  [516100,0.32],[774200,0.35],[Infinity,0.37]
];
const BRACKETS_2027 = [
  [25400,0.10],[103050,0.12],[220050,0.22],[420000,0.24],
  [533400,0.32],[799600,0.35],[Infinity,0.37]
];

function calcTax(taxable, brackets) {
  let tax = 0, prev = 0;
  for (const [limit, rate] of brackets) {
    if (taxable <= prev) break;
    tax += (Math.min(taxable, limit) - prev) * rate;
    prev = limit;
  }
  return tax;
}
function marginalRate(taxable, brackets) {
  let prev = 0;
  for (const [limit, rate] of brackets) {
    if (taxable <= limit) return rate;
    prev = limit;
  }
  return brackets[brackets.length - 1][1];
}
function deductionSavings(income, existingDed, newDed, brackets, bonusPct) {
  const deduction = newDed * bonusPct;
  const before = Math.max(0, income - existingDed);
  const after  = Math.max(0, before - deduction);
  return {
    fed: calcTax(before, brackets) - calcTax(after, brackets),
    deduction,
    netCost: newDed - (calcTax(before, brackets) - calcTax(after, brackets)),
    effectiveRate: before > 0 ? (calcTax(before, brackets) - calcTax(after, brackets)) / deduction : 0,
  };
}
function bracketLabel(taxable, brackets) {
  let prev = 0;
  for (const [limit, rate] of brackets) {
    if (taxable <= limit) return `${(rate*100).toFixed(0)}% bracket ($${prev.toLocaleString()}–${limit === Infinity ? "∞" : "$"+limit.toLocaleString()})`;
    prev = limit;
  }
  return "37%";
}

// ── Purchase types ────────────────────────────────────────────────────────────
const TYPES = [
  { id:"furniture",   label:"Furniture & Soft Furnishings",   class:"5yr",  b26:1.00, b27:1.00, sign:"♋", desc:"Sofas, beds, dining, rugs, art — all moveable items" },
  { id:"appliances",  label:"Major Appliances",                class:"5yr",  b26:1.00, b27:1.00, sign:"♌", desc:"Fridge, oven, washer, dryer, dishwasher" },
  { id:"small_appl",  label:"Small Appliances & Tech",         class:"5yr",  b26:1.00, b27:1.00, sign:"♍", desc:"Coffee machine, toaster, smart locks, AV equipment" },
  { id:"doors",       label:"Doors, Hardware & Exterior Locks",class:"5yr",  b26:1.00, b27:1.00, sign:"♏", desc:"Exterior/interior doors, smart locks, hardware" },
  { id:"pool",        label:"Pool & Outdoor Equipment",        class:"15yr", b26:1.00, b27:1.00, sign:"♒", desc:"Pump, heater, salt conversion, equipment (not structure)" },
  { id:"deck",        label:"Deck, Pergola & Outdoor Structures",class:"15yr",b26:1.00, b27:1.00, sign:"♐", desc:"Deck, jacuzzi, pergola, patio cover, fencing" },
  { id:"landscape",   label:"Landscaping & Irrigation",        class:"15yr", b26:1.00, b27:1.00, sign:"♉", desc:"Gravel, plants, irrigation system, outdoor lighting" },
  { id:"flooring_qip",label:"New Flooring — QIP (tile, hardwood, vinyl)",class:"15yr",b26:1.00,b27:1.00,sign:"♎",desc:"New material installed on rental property. Qualifies as QIP → 15yr → 100% bonus." },
  { id:"flooring_conc",label:"Concrete Grind & Polish (restore original)",class:"qip_or_exp",b26:1.00,b27:1.00,sign:"☿",desc:"Restoring original concrete. Likely QIP (15yr/100% bonus) or repair expense. Same deduction — simpler if expensed. Confirm with Kevin." },
  { id:"slider_patio",label:"Patio Addition, Glazing & Sliders",class:"mixed",b26:0.50,b27:0.50,sign:"☽",desc:"~50% structural (39yr, old 20% bonus) + ~50% exterior feature (15yr, 100% bonus). Blended rate." },
  { id:"structural",  label:"Structural / Built-In Work",      class:"39yr", b26:0.20, b27:0.20, sign:"♑", desc:"Built-in cabinets, tile installs, countertops, laundry plumbing, additions. Acquired May 2024 — OLD 20% bonus rules." },
  { id:"paint",       label:"Paint, Caulk & Minor Repairs",    class:"exp",  b26:1.00, b27:1.00, sign:"☉", desc:"Maintenance & repair — deducted in full the year incurred. NOT depreciated." },
  { id:"services",    label:"Ongoing Services (annual cost)",  class:"exp",  b26:1.00, b27:1.00, sign:"⊕", desc:"Cleaning, pool service, pest control, landscaping maintenance. Full deduction year incurred." },
  { id:"costseg",     label:"Cost Segregation Study",          class:"2026only",b26:1.00,b27:1.00,sign:"⭐",desc:"MUST be done in 2026. Without this study, none of the bonus depreciation applies. This is the prerequisite for everything else." },
];

// ── Log slider helpers ────────────────────────────────────────────────────────
const SLIDER_MIN = 0, SLIDER_MAX = 1000;
const COST_MIN = 100, COST_MAX = 100000;
function sliderToCost(s) {
  return Math.round(Math.pow(10, 2 + (s / 1000) * 3) / 50) * 50;
}
function costToSlider(c) {
  return Math.round(((Math.log10(c) - 2) / 3) * 1000);
}

// ── Stars ─────────────────────────────────────────────────────────────────────
const STARS = Array.from({length:60},(_,i)=>({
  id:i, x:Math.random()*100, y:Math.random()*100,
  r:Math.random()*1.8+0.4, op:Math.random()*0.5+0.15,
  dur:Math.random()*4+2, del:Math.random()*3
}));
function Stars() {
  return (
    <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0}}>
      {STARS.map(s=>(
        <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#e8d278" opacity={s.op}>
          <animate attributeName="opacity" values={`${s.op};${s.op*0.3};${s.op}`}
            dur={`${s.dur}s`} begin={`${s.del}s`} repeatCount="indefinite"/>
        </circle>
      ))}
    </svg>
  );
}

// ── Income input ──────────────────────────────────────────────────────────────
function MoneyInput({label, sub, value, onChange, color}) {
  const [raw, setRaw] = useState(value.toLocaleString());
  useEffect(()=>{ setRaw(value.toLocaleString()); },[value]);
  return (
    <div style={{flex:1}}>
      <div style={{fontFamily:"'Courier New',monospace",fontSize:8,letterSpacing:"2.5px",
        color,textTransform:"uppercase",marginBottom:5}}>{label}</div>
      {sub && <div style={{fontFamily:"Georgia,serif",fontSize:10,color:"#555",
        fontStyle:"italic",marginBottom:5}}>{sub}</div>}
      <div style={{display:"flex",alignItems:"center",gap:4,
        background:"#0d0a1a",border:`1px solid ${color}44`,borderRadius:5,padding:"8px 12px"}}>
        <span style={{fontFamily:"'Courier New',monospace",fontSize:13,color}}> $</span>
        <input type="text" value={raw}
          onChange={e=>{
            const v = e.target.value.replace(/[^0-9]/g,"");
            setRaw(v ? parseInt(v).toLocaleString() : "");
            const n = parseInt(v.replace(/,/g,""));
            if(!isNaN(n)&&n>0) onChange(n);
          }}
          style={{flex:1,background:"transparent",border:"none",outline:"none",
            fontFamily:"'Palatino Linotype',Palatino,serif",fontSize:16,color:"#e8d278",
            textAlign:"right",minWidth:0}}
        />
      </div>
    </div>
  );
}

// ── Bracket chip ──────────────────────────────────────────────────────────────
function BracketChip({taxable, brackets, color}) {
  const rate = marginalRate(taxable, brackets);
  const rateColor = rate<=0.22?"#7de8a0":rate<=0.24?"#c8d060":rate<=0.32?"#e8c040":rate<=0.35?"#e8a040":"#e84040";
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,
      background:"#ffffff08",borderRadius:4,padding:"4px 8px",marginTop:4}}>
      <div style={{width:6,height:6,borderRadius:"50%",background:rateColor,flexShrink:0}}/>
      <span style={{fontFamily:"'Courier New',monospace",fontSize:9,color:"#888",letterSpacing:"1.5px"}}>
        MARGINAL RATE: </span>
      <span style={{fontFamily:"'Courier New',monospace",fontSize:11,color:rateColor,fontWeight:"bold"}}>
        {(rate*100).toFixed(0)}%</span>
      <span style={{fontFamily:"'Courier New',monospace",fontSize:9,color:"#444",letterSpacing:"1px"}}>
        on next dollar · taxable ${taxable.toLocaleString()}</span>
    </div>
  );
}

// ── Year card (side-by-side) ──────────────────────────────────────────────────
function YearCard({yearLabel, result, isBetter, income, existingDed, brackets, cost, isExp, is2026only}) {
  const taxable = Math.max(0, income - existingDed);
  const mRate = marginalRate(taxable, brackets);
  const rateColor = mRate<=0.22?"#7de8a0":mRate<=0.24?"#c8d060":mRate<=0.32?"#e8c040":mRate<=0.35?"#e8a040":"#e84040";
  return (
    <div style={{flex:1,background: isBetter?"#0a1408":"#0a0818",
      border:`1px solid ${isBetter?"#5cb87a55":"#5a4a8a44"}`,
      borderTop:`3px solid ${isBetter?"#5cb87a":"#5a4a8a"}`,
      borderRadius:6,padding:"16px 14px",position:"relative",overflow:"hidden"}}>
      {isBetter && (
        <div style={{position:"absolute",top:8,right:8,
          fontFamily:"'Courier New',monospace",fontSize:8,letterSpacing:"2px",
          color:"#5cb87a",background:"#0a2010",border:"1px solid #5cb87a44",
          borderRadius:3,padding:"2px 6px"}}>◉ FAVOURED</div>
      )}
      <div style={{fontFamily:"'Palatino Linotype',Palatino,serif",fontSize:20,
        color: isBetter?"#7de8a0":"#9a88c8",marginBottom:2}}>{yearLabel}</div>
      <div style={{fontFamily:"'Courier New',monospace",fontSize:9,color:rateColor,
        letterSpacing:"1.5px",marginBottom:12}}>MARGINAL RATE: {(mRate*100).toFixed(0)}%</div>

      {is2026only && yearLabel!=="2026" ? (
        <div style={{fontFamily:"Georgia,serif",fontSize:12,color:"#5a4a3a",
          fontStyle:"italic",lineHeight:1.6,padding:"8px 0"}}>
          Must be completed in 2026 — prerequisite for all other deductions
        </div>
      ) : (
        <>
          <div style={{borderBottom:"1px solid #ffffff0a",paddingBottom:10,marginBottom:10}}>
            <div style={{fontFamily:"'Courier New',monospace",fontSize:8,color:"#555",
              letterSpacing:"2px",textTransform:"uppercase",marginBottom:3}}>deduction</div>
            <div style={{fontFamily:"'Palatino Linotype',Palatino,serif",fontSize:22,color:"#e8d8a0"}}>
              ${result.deduction.toLocaleString(undefined,{maximumFractionDigits:0})}
            </div>
          </div>
          <div style={{borderBottom:"1px solid #ffffff0a",paddingBottom:10,marginBottom:10}}>
            <div style={{fontFamily:"'Courier New',monospace",fontSize:8,color:"#555",
              letterSpacing:"2px",textTransform:"uppercase",marginBottom:3}}>tax saved</div>
            <div style={{fontFamily:"'Palatino Linotype',Palatino,serif",
              fontSize:22,color: isBetter?"#7de8a0":"#c8b8e8"}}>
              ${result.fed.toLocaleString(undefined,{maximumFractionDigits:0})}
            </div>
          </div>
          <div>
            <div style={{fontFamily:"'Courier New',monospace",fontSize:8,color:"#555",
              letterSpacing:"2px",textTransform:"uppercase",marginBottom:3}}>
              effective net cost</div>
            <div style={{fontFamily:"'Palatino Linotype',Palatino,serif",
              fontSize:26,color: isBetter?"#a0ffc0":"#d8ccf0",letterSpacing:"-0.5px"}}>
              ${result.netCost.toLocaleString(undefined,{maximumFractionDigits:0})}
            </div>
            <div style={{fontFamily:"'Courier New',monospace",fontSize:9,color:"#444",marginTop:2}}>
              of ${cost.toLocaleString()} spent
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Decision verdict ──────────────────────────────────────────────────────────
function Verdict({r26, r27, cost, type, income26, ded26, income27, ded27}) {
  if (!type) return null;
  const diff = r27.fed - r26.fed;
  const timeAdj26 = r26.fed * 1.05;
  const netAdvantage27 = r27.fed - timeAdj26;
  const pctAdv = r26.fed > 0 ? (netAdvantage27 / r26.fed) * 100 : 0;

  const taxable26 = Math.max(0, income26 - ded26);
  const mRate26 = marginalRate(taxable26, BRACKETS_2026);
  const taxable27 = Math.max(0, income27 - ded27);
  const mRate27 = marginalRate(taxable27, BRACKETS_2027);

  let verdict, color, icon;
  if (type.class === "2026only") {
    verdict = "This is a 2026 prerequisite — no choice here. Complete before Dec 31, 2026.";
    color = "#e8d278"; icon = "⭐";
  } else if (type.class === "exp") {
    verdict = `Operating expenses are better in 2027 — same 100% deduction but at ${(mRate27*100).toFixed(0)}% vs ${(mRate26*100).toFixed(0)}% this year. Defer unless you need the 2026 cash flow.`;
    color = "#e8a84a"; icon = "◇";
  } else if (pctAdv > 25) {
    verdict = `2027 is meaningfully better — the ${(mRate27*100).toFixed(0)}% bracket vs ${(mRate26*100).toFixed(0)}% this year means a ${pctAdv.toFixed(0)}% better return per dollar even after time value. Defer if cash flow allows.`;
    color = "#e8a84a"; icon = "◇";
  } else if (pctAdv > 8) {
    verdict = `2027 has a moderate edge (${pctAdv.toFixed(0)}% better after time value) due to higher marginal rate. Buy in 2027 unless you need the item in service before Dec 2026 or need the early refund.`;
    color = "#e8c040"; icon = "◈";
  } else {
    verdict = `Near wash after time value — buy when operationally ready. 2026 is fine if you need the property ready or want the refund in April 2027.`;
    color = "#7de8a0"; icon = "✦";
  }

  const showRepsNote = type.class !== "exp" && type.class !== "2026only";

  return (
    <div style={{marginTop:16,padding:"16px 20px",background:"#0a0c10",
      border:`1px solid ${color}33`,borderLeft:`3px solid ${color}`,borderRadius:6}}>
      <div style={{fontFamily:"'Palatino Linotype',Palatino,serif",
        fontSize:13,color,marginBottom:8}}>{icon} The Stars Counsel</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:12.5,color:"#b8a888",
        lineHeight:1.75,marginBottom:12}}>{verdict}</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        {[
          ["2027 raw advantage",`+$${Math.abs(diff).toLocaleString(undefined,{maximumFractionDigits:0})}`, diff>0?"#c8b8e8":"#7de8a0"],
          ["2026 × 1.05 (time adj)",`$${timeAdj26.toLocaleString(undefined,{maximumFractionDigits:0})}`, "#e8d278"],
          ["net 2027 advantage after TVM",`${pctAdv>0?"+":""}${pctAdv.toFixed(0)}%`, pctAdv>10?"#e8a040":pctAdv>0?"#e8d278":"#7de8a0"],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:"#ffffff06",borderRadius:4,padding:"6px 10px"}}>
            <div style={{fontFamily:"'Courier New',monospace",fontSize:8,color:"#555",
              letterSpacing:"2px",textTransform:"uppercase",marginBottom:3,lineHeight:1.4}}>{l}</div>
            <div style={{fontFamily:"'Palatino Linotype',Palatino,serif",fontSize:15,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div style={{background:"#0a1408",border:"1px solid #3a6a3a33",borderRadius:4,padding:"8px 12px"}}>
          <div style={{fontFamily:"'Courier New',monospace",fontSize:8,color:"#3a8a50",
            letterSpacing:"2px",textTransform:"uppercase",marginBottom:4}}>✦ Buy in 2026 when</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:11,color:"#7a9a7a",lineHeight:1.6}}>
            Property needs to be furnished by Dec 31 · Need April 2027 refund for 2nd property · REPS documentation needs active rental activity · Item enables in-service date
          </div>
        </div>
        <div style={{background:"#100a08",border:"1px solid #6a3a1a33",borderRadius:4,padding:"8px 12px"}}>
          <div style={{fontFamily:"'Courier New',monospace",fontSize:8,color:"#8a5030",
            letterSpacing:"2px",textTransform:"uppercase",marginBottom:4}}>◇ Wait for 2027 when</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:11,color:"#9a7a6a",lineHeight:1.6}}>
            Cash flow not urgent · Item doesn't affect Dec 2026 in-service date · Want to maximise 35% bracket savings against IPO income · Services &amp; ongoing costs
          </div>
        </div>
      </div>

      {showRepsNote && (
        <div style={{marginTop:10,padding:"8px 12px",background:"#ffffff05",borderRadius:4,
          display:"flex",gap:10,alignItems:"flex-start"}}>
          <span style={{color:"#e8a840",fontSize:14,flexShrink:0}}>⚡</span>
          <div style={{fontFamily:"'Courier New',monospace",fontSize:9,color:"#7a6040",
            letterSpacing:"1px",lineHeight:1.6}}>
            REPS NOTE: If REPS is not achieved in 2026, rental losses are passive and carry forward.
            2027 purchases apply against confirmed STR income regardless of REPS status — zero passive loss risk.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RepsMyLittleBabies() {
  const [typeId, setTypeId] = useState("furniture");
  const [sliderPos, setSliderPos] = useState(costToSlider(4000));
  const [cost, setCost] = useState(4000);
  const [costInput, setCostInput] = useState("4,000");

  const [income26, setIncome26] = useState(334000);
  const [ded26, setDed26] = useState(200000);
  const [income27, setIncome27] = useState(800000);
  const [ded27, setDed27] = useState(165000);

  const [showConfig, setShowConfig] = useState(false);

  const type = TYPES.find(t => t.id === typeId);

  const taxable26 = Math.max(0, income26 - ded26);
  const taxable27 = Math.max(0, income27 - ded27);

  const r26 = deductionSavings(income26, ded26, cost, BRACKETS_2026, type?.b26 ?? 1);
  const r27 = deductionSavings(income27, ded27, cost, BRACKETS_2027, type?.b27 ?? 1);

  const better = (() => {
    if (type?.class === "2026only") return "2026";
    if (type?.class === "exp") return "2027";
    return r27.fed > r26.fed * 1.05 ? "2027" : "2026";
  })();

  const handleSlider = (e) => {
    const pos = parseInt(e.target.value);
    setSliderPos(pos);
    const c = sliderToCost(pos);
    setCost(c);
    setCostInput(c.toLocaleString());
  };

  const handleCostInput = (val) => {
    const n = parseInt(val.replace(/,/g,""));
    if (!isNaN(n) && n >= 100) {
      setCost(n);
      setSliderPos(costToSlider(Math.min(n, COST_MAX)));
    }
  };

  return (
    <div style={{minHeight:"100vh",
      background:"radial-gradient(ellipse at 20% 10%, #180a2e 0%, #080410 40%, #000205 70%, #000)",
      color:"#e8e0d0",fontFamily:"Georgia,'Palatino Linotype',serif",
      position:"relative",overflow:"hidden",fontSize:13}}>
      <Stars/>
      <div style={{position:"fixed",top:"-15%",left:"50%",transform:"translateX(-50%)",
        width:500,height:250,
        background:"radial-gradient(ellipse,#2a0a4a18,transparent 70%)",
        pointerEvents:"none",zIndex:0}}/>

      <div style={{position:"relative",zIndex:1,maxWidth:620,margin:"0 auto",padding:"32px 20px 60px"}}>

        {/* Header */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontFamily:"'Courier New',monospace",fontSize:8,letterSpacing:"5px",
            color:"#6a5a9a",textTransform:"uppercase",marginBottom:10}}>
            ✦ Palm Springs Property · Celestial Tax Counsel ✦
          </div>
          <h1 style={{fontFamily:"'Palatino Linotype',Palatino,serif",fontSize:30,
            fontWeight:400,letterSpacing:"2px",color:"#e8d278",margin:"0 0 4px",
            textShadow:"0 0 40px #c8a02088",lineHeight:1.2}}>
            REPs, My Little Babies
          </h1>
          <div style={{fontFamily:"Georgia,serif",fontSize:12,color:"#8a7a6a",
            fontStyle:"italic",marginBottom:6}}>
            channelling the witch herself
          </div>
          <div style={{fontFamily:"'Courier New',monospace",fontSize:8,letterSpacing:"3px",
            color:"#4a3a6a",textTransform:"uppercase"}}>
            when should you spend · what will the stars return
          </div>
        </div>

        {/* Income / Deduction Config */}
        <div style={{marginBottom:24}}>
          <button onClick={()=>setShowConfig(!showConfig)} style={{
            width:"100%",padding:"10px 16px",
            background:"#0d0a18",border:"1px solid #2a1a4a",borderRadius:6,
            color:"#8878b8",fontFamily:"'Courier New',monospace",fontSize:9,
            letterSpacing:"2.5px",textTransform:"uppercase",cursor:"pointer",
            display:"flex",justifyContent:"space-between",alignItems:"center",
          }}>
            <span>✦ Income & Deduction Configuration</span>
            <span style={{fontSize:12,transition:"transform 0.2s",
              transform:showConfig?"rotate(180deg)":"none"}}>▾</span>
          </button>

          {showConfig && (
            <div style={{background:"#0a0818",border:"1px solid #2a1a4a",
              borderTop:"none",borderRadius:"0 0 6px 6px",padding:"16px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
                <div>
                  <div style={{fontFamily:"'Courier New',monospace",fontSize:8,
                    color:"#c8b560",letterSpacing:"2px",textTransform:"uppercase",
                    marginBottom:8,paddingBottom:4,borderBottom:"1px solid #2a1a3a"}}>2026</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <MoneyInput label="Gross Income" value={income26} onChange={setIncome26} color="#c8b560"
                      sub="W2 + secondary sale"/>
                    <MoneyInput label="Existing Deductions" value={ded26} onChange={setDed26} color="#8878b8"
                      sub="Mortgage int + cost seg + committed reno"/>
                  </div>
                  <BracketChip taxable={taxable26} brackets={BRACKETS_2026} color="#c8b560"/>
                </div>
                <div>
                  <div style={{fontFamily:"'Courier New',monospace",fontSize:8,
                    color:"#7de8a0",letterSpacing:"2px",textTransform:"uppercase",
                    marginBottom:8,paddingBottom:4,borderBottom:"1px solid #1a2a1a"}}>2027</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <MoneyInput label="Gross Income" value={income27} onChange={setIncome27} color="#7de8a0"
                      sub="W2 + IPO equity income"/>
                    <MoneyInput label="Existing Deductions" value={ded27} onChange={setDed27} color="#8878b8"
                      sub="Mortgage int + PS SL + 2nd prop bonus"/>
                  </div>
                  <BracketChip taxable={taxable27} brackets={BRACKETS_2027} color="#7de8a0"/>
                </div>
              </div>
              <div style={{fontFamily:"'Courier New',monospace",fontSize:8,color:"#444",
                letterSpacing:"1.5px",lineHeight:1.8,textAlign:"center"}}>
                Deductions shown exclude the purchase being evaluated · Adjust as your plan evolves
              </div>
            </div>
          )}
          {!showConfig && (
            <div style={{display:"flex",gap:8,marginTop:6}}>
              <BracketChip taxable={taxable26} brackets={BRACKETS_2026}/>
              <BracketChip taxable={taxable27} brackets={BRACKETS_2027}/>
            </div>
          )}
        </div>

        {/* Type selector */}
        <div style={{marginBottom:20}}>
          <div style={{fontFamily:"'Courier New',monospace",fontSize:8,letterSpacing:"3px",
            color:"#7a6abc",textTransform:"uppercase",marginBottom:6}}>✦ what are you buying?</div>
          <div style={{position:"relative"}}>
            <select value={typeId} onChange={e=>setTypeId(e.target.value)} style={{
              width:"100%",padding:"12px 40px 12px 16px",background:"#0d0a1a",
              border:"1px solid #3a2a6a",borderRadius:6,color:"#e8d278",
              fontFamily:"'Palatino Linotype',Palatino,serif",fontSize:14,
              cursor:"pointer",outline:"none",appearance:"none",
              boxShadow:"0 0 20px #3a2a6a22"}}>
              {TYPES.map(t=>(
                <option key={t.id} value={t.id}>{t.sign}  {t.label}</option>
              ))}
            </select>
            <div style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",
              color:"#7a6abc",pointerEvents:"none"}}>▾</div>
          </div>
          {type && (
            <div style={{fontFamily:"Georgia,serif",fontSize:10.5,color:"#6a5a7a",
              fontStyle:"italic",marginTop:5,paddingLeft:2,lineHeight:1.5}}>
              {type.sign} {type.desc}
              {type.b26 !== type.b27 || type.b26 < 1
                ? ` · Bonus: ${(type.b26*100).toFixed(0)}% (2026) / ${(type.b27*100).toFixed(0)}% (2027)`
                : ` · ${(type.b26*100).toFixed(0)}% bonus both years`
              }
            </div>
          )}
        </div>

        {/* Cost input + slider */}
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontFamily:"'Courier New',monospace",fontSize:8,letterSpacing:"3px",
              color:"#7a6abc",textTransform:"uppercase"}}>✦ the sum in question</div>
            <div style={{display:"flex",alignItems:"center",gap:4,
              background:"#0d0a1a",border:"1px solid #3a2a6a",borderRadius:5,
              padding:"5px 10px"}}>
              <span style={{fontFamily:"'Courier New',monospace",fontSize:12,color:"#7a6abc"}}>$</span>
              <input type="text" value={costInput}
                onChange={e=>{
                  const raw = e.target.value.replace(/[^0-9]/g,"");
                  const n = parseInt(raw);
                  setCostInput(raw ? n.toLocaleString() : "");
                  handleCostInput(raw);
                }}
                style={{width:80,background:"transparent",border:"none",outline:"none",
                  fontFamily:"'Palatino Linotype',Palatino,serif",fontSize:16,
                  color:"#e8d278",textAlign:"right"}}/>
            </div>
          </div>
          <input type="range" min={SLIDER_MIN} max={SLIDER_MAX} step={1}
            value={sliderPos} onChange={handleSlider}
            style={{width:"100%",height:4,cursor:"pointer",accentColor:"#c8b560",
              background:`linear-gradient(90deg,#c8b560 ${sliderPos/10}%,#2a1a4a ${sliderPos/10}%)`}}/>
          <div style={{display:"flex",justifyContent:"space-between",
            fontFamily:"'Courier New',monospace",fontSize:8,color:"#3a2a5a",marginTop:3}}>
            {["$100","$300","$1K","$3K","$10K","$30K","$100K"].map((l,i)=>(
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>

        {/* Side-by-side cards */}
        <div style={{display:"flex",gap:10,marginBottom:4}}>
          <YearCard yearLabel="2026" result={r26} isBetter={better==="2026"}
            income={income26} existingDed={ded26} brackets={BRACKETS_2026}
            cost={cost} isExp={type?.class==="exp"} is2026only={type?.class==="2026only"}/>
          <YearCard yearLabel="2027" result={r27} isBetter={better==="2027"}
            income={income27} existingDed={ded27} brackets={BRACKETS_2027}
            cost={cost} isExp={type?.class==="exp"} is2026only={type?.class==="2026only"}/>
        </div>

        {/* Verdict + framework */}
        <Verdict r26={r26} r27={r27} cost={cost} type={type}
          income26={income26} ded26={ded26}
          income27={income27} ded27={ded27}/>

        {/* Footer disclaimer */}
        <div style={{marginTop:40,paddingTop:20,borderTop:"1px solid #1a0a2a44"}}>
          <div style={{fontFamily:"'Courier New',monospace",fontSize:8,letterSpacing:"2px",
            color:"#c8a840",textTransform:"uppercase",marginBottom:8}}>
            ✦ Prerequisites for these numbers to hold
          </div>
          {[
            ["Cost Segregation Study (2026)","Must be completed and filed before Dec 31, 2026. Without this, bonus depreciation classifications don't exist. ~$4–6K cost — deducted in full."],
            ["Real Estate Professional Status (REPS)","Jessi must document 750+ hours AND majority-of-work-time in real estate activities. Without REPS, 2026 rental losses are passive and carry forward (not lost — just deferred to 2027 STR income)."],
            ["Property In-Service by Dec 31, 2026","Must be listed, furnished, and available for rental (even a 29+ day listing without bookings qualifies). Establishes the 2026 tax year for all depreciation."],
            ["New Items Acquired After Jan 19, 2025","100% bonus depreciation only applies to property acquired and placed in service after this date. Your original building (May 2024) uses old 20% rules — reflected above."],
            ["OBBBA 100% Bonus Depreciation — Permanent","Signed July 4, 2025. Applies equally to 2026 and 2027. No urgency-based timing pressure from bonus dep rates."],
            ["Residential Solar ITC — Expired","The 25D residential solar tax credit ended Dec 31, 2025. No federal credit for homeowner-purchased solar in 2026. Ask Kevin about Section 48 commercial ITC if solar goes on rental property."],
          ].map(([title,body])=>(
            <div key={title} style={{display:"flex",gap:8,marginBottom:8,
              paddingBottom:8,borderBottom:"1px solid #1a0a2a33"}}>
              <div style={{color:"#6a5a3a",marginTop:1,flexShrink:0}}>◎</div>
              <div>
                <div style={{fontFamily:"'Courier New',monospace",fontSize:9,
                  color:"#7a6a4a",letterSpacing:"1px",marginBottom:2}}>{title}</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:11,color:"#4a4038",lineHeight:1.5}}>{body}</div>
              </div>
            </div>
          ))}
          <div style={{fontFamily:"'Courier New',monospace",fontSize:8,
            color:"#3a2a2a",letterSpacing:"2px",textAlign:"center",marginTop:12,lineHeight:2}}>
            Not financial advice. The stars cannot be held liable.<br/>
            Confirm all strategies with Kevin at Bean Counters before executing.
          </div>
        </div>
      </div>

      <style>{`
        select option{background:#0d0a1a;color:#e8d278}
        input[type=range]{-webkit-appearance:none;appearance:none;border-radius:2px}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;
          border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffe8a0,#c8a020);
          box-shadow:0 0 10px #c8a02088;cursor:pointer}
        input[type=range]::-moz-range-thumb{width:18px;height:18px;border-radius:50%;
          background:radial-gradient(circle at 35% 35%,#ffe8a0,#c8a020);border:none;cursor:pointer}
      `}</style>
    </div>
  );
}
