export default function Scene({ kind = "tortoise-and-hare", className = "" }: { kind?: string; className?: string }) {
  const ark = kind === "noahs-ark";
  const red = kind === "little-red-riding-hood";
  const pigs = kind === "three-little-pigs";
  return <svg className={className} viewBox="0 0 600 440" role="img" aria-label={ark ? "An ark beneath a rainbow" : red ? "A little red cape in an enchanted forest" : pigs ? "Little houses in a meadow" : "A tortoise and hare in a sunny meadow"}>
    <rect width="600" height="440" fill={ark ? "#d1e5df" : red ? "#d7ddd0" : "#e6e5ca"}/>
    {ark && <><path d="M95 230a205 205 0 0 1 410 0" fill="none" stroke="#db9383" strokeWidth="23"/><path d="M120 230a180 180 0 0 1 360 0" fill="none" stroke="#eac578" strokeWidth="20"/><path d="M142 230a158 158 0 0 1 316 0" fill="none" stroke="#99b69b" strokeWidth="18"/></>}
    <circle cx="468" cy="85" r="38" fill="#efc67e"/>
    <path d="M0 275Q130 180 300 276T600 250V440H0Z" fill="#abc1a0"/>
    <path d="M0 340Q170 230 350 335T600 300V440H0Z" fill={ark ? "#91bfc1" : "#73977c"}/>
    {!ark && [65,130,520,570].map((x,i) => <g key={x}><path d={`M${x} ${350-i*18}v-170`} stroke="#6a7252" strokeWidth="12"/><ellipse cx={x} cy={155-i*12} rx="56" ry="90" fill={i%2 ? "#92aa7f" : "#597f69"}/></g>)}
    {ark ? <g><path d="M160 280h300l-45 83H205Z" fill="#9b694e"/><rect x="213" y="206" width="196" height="77" rx="10" fill="#b88a61"/><path d="m193 213 119-68 118 68" fill="#855b47"/>{[242,300,358].map(x => <circle key={x} cx={x} cy="246" r="14" fill="#514f42"/>)}<path d="M0 365q50-22 100 0t100 0t100 0t100 0t100 0t100 0" fill="none" stroke="#c6e0d6" strokeWidth="8"/></g>
      : pigs ? <g>{[160,290,415].map((x,i) => <g key={x}><rect x={x-45} y={280-i*14} width="95" height="92" fill={["#d4b675","#b89368","#b46e58"][i]}/><path d={`M${x-60} ${285-i*14}l62-60 62 60Z`} fill={["#be995e","#8c7157","#845749"][i]}/><rect x={x-8} y={320-i*14} width="28" height="52" rx="12" fill="#5e6656"/></g>)}</g>
      : red ? <g><path d="M285 310q-24-75 13-89 46-10 42 87l32 68H258Z" fill="#b9584d"/><circle cx="309" cy="252" r="20" fill="#efcc9e"/><path d="m277 230 38-25 28 38" fill="#a84843"/><path d="M336 321q65-48 55 22l-45 5Z" fill="#ad885a"/></g>
      : <g><ellipse cx="245" cy="334" rx="72" ry="49" fill="#779166"/><path d="M186 332q60-92 117 0" fill="#ab9c65" stroke="#68734e" strokeWidth="5"/><path d="m228 292 24 42-32 38m32-38 37-15" fill="none" stroke="#827b50" strokeWidth="4"/><ellipse cx="321" cy="333" rx="28" ry="25" fill="#93ab79"/><circle cx="331" cy="326" r="4" fill="#434d3d"/><ellipse cx="407" cy="310" rx="30" ry="48" fill="#b69672"/><ellipse cx="416" cy="253" rx="25" ry="28" fill="#c6a781"/><ellipse cx="408" cy="209" rx="9" ry="39" fill="#b69672" transform="rotate(-15 408 209)"/><ellipse cx="429" cy="211" rx="9" ry="39" fill="#c6a781" transform="rotate(12 429 211)"/><circle cx="428" cy="249" r="3" fill="#434d3d"/></g>}
    {[90,160,360,460,540].map((x,i) => <g key={x}><path d={`M${x} 410v-22`} stroke="#516e51" strokeWidth="2"/><circle cx={x} cy="388" r={6+i%3} fill={i%2 ? "#e6bf7d" : "#e1b5a5"}/></g>)}
    <path d="m65 63 4 10 11 2-9 7 2 11-9-6-10 5 3-11-8-8 11-1Z" fill="#fcf2d8"/>
  </svg>;
}
