/**
 * Equipment artwork.
 *
 * These are drawn, not photographed. Realistic photographs of specific lab
 * machines are not something this repository can obtain: the free keyword photo
 * services return loosely-matched images with attribution watermarked into the
 * pixels — a 1970s museum equipment rack came back for "oscilloscope" — which
 * looks worse on a card than an honest illustration.
 *
 * So each category gets a studio-lit product render: a soft sweep backdrop, a
 * recognisable device in one palette, and a contact shadow. They read as a
 * deliberate catalogue rather than as missing photographs, and any one of them
 * can be replaced by uploading a real photo through the admin screens.
 */

const INK = "#2A2F45";
const INK_DARK = "#1B2033";
const METAL = "#8A93AC";
const METAL_LIGHT = "#B8C0D4";
const ACCENT = "#1E2B8A";
const SCREEN = "#7FD8E8";
const WARM = "#C98A4B";

const DEFS = `
<defs>
  <linearGradient id="sweep" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#F4F5F9"/><stop offset="62%" stop-color="#E7E9F1"/><stop offset="100%" stop-color="#D7DAE6"/>
  </linearGradient>
  <radialGradient id="pool" cx="50%" cy="42%" r="62%">
    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#4A5170"/><stop offset="100%" stop-color="#1B2033"/>
  </linearGradient>
  <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#B8C0D4"/><stop offset="50%" stop-color="#8A93AC"/><stop offset="100%" stop-color="#6E7691"/>
  </linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#12324A"/><stop offset="100%" stop-color="#0A1C2C"/>
  </linearGradient>
  <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#D8A56A"/><stop offset="100%" stop-color="#A9763F"/>
  </linearGradient>
  <linearGradient id="pcb" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#237A56"/><stop offset="100%" stop-color="#14miss"/>
  </linearGradient>
  <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>
</defs>`;

const shadow = (cx: number, cy: number, rx: number, ry = 16) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#3A3F55" opacity="0.22" filter="url(#soft)"/>`;

const line = (x: number, y: number, w: number, o = 0.9) =>
  `<rect x="${x}" y="${y}" width="${w}" height="3" rx="1.5" fill="${SCREEN}" opacity="${o}"/>`;

const knob = (cx: number, cy: number, r: number) => `
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#metal)"/>
  <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="${INK_DARK}" opacity="0.55"/>
  <rect x="${cx - 1.2}" y="${cy - r * 0.55}" width="2.4" height="${r * 0.5}" rx="1.2" fill="${METAL_LIGHT}"/>`;

const grid = (x: number, y: number, w: number, h: number, cols: number, rows: number) =>
  `<g opacity="0.16" stroke="${SCREEN}" stroke-width="1">
    ${Array.from({ length: cols }, (_, i) => `<path d="M${x + i * (w / cols)} ${y} v${h}"/>`).join("")}
    ${Array.from({ length: rows }, (_, i) => `<path d="M${x} ${y + i * (h / rows)} h${w}"/>`).join("")}
  </g>`;

const devices: Record<string, string> = {
  "3D Printing": `
    ${shadow(400, 452, 160)}
    <rect x="248" y="150" width="304" height="290" rx="10" fill="none" stroke="${METAL}" stroke-width="9"/>
    <rect x="262" y="404" width="276" height="34" rx="6" fill="url(#body)"/>
    <rect x="286" y="374" width="228" height="20" rx="4" fill="url(#metal)"/>
    <rect x="248" y="228" width="304" height="16" rx="4" fill="url(#metal)"/>
    <rect x="372" y="236" width="58" height="52" rx="6" fill="url(#body)"/>
    <path d="M394 288 l14 0 l-7 16 z" fill="${METAL_LIGHT}"/>
    <rect x="336" y="318" width="128" height="58" rx="5" fill="${WARM}" opacity="0.92"/>
    <rect x="336" y="318" width="128" height="12" rx="5" fill="#E0B27E" opacity="0.7"/>
    <circle cx="219" cy="273" r="27" fill="none" stroke="${METAL}" stroke-width="8"/>
    <circle cx="219" cy="273" r="8" fill="${INK}"/>
    <rect x="262" y="416" width="70" height="12" rx="3" fill="${SCREEN}" opacity="0.55"/>`,

  "Laser & CNC": `
    ${shadow(400, 448, 190)}
    <rect x="196" y="216" width="408" height="30" rx="8" fill="url(#metal)" opacity="0.85"/>
    <rect x="182" y="238" width="436" height="196" rx="12" fill="url(#body)"/>
    <rect x="196" y="252" width="408" height="126" rx="8" fill="#151A2B"/>
    <rect x="212" y="266" width="376" height="98" rx="4" fill="#0E1322"/>
    <rect x="316" y="252" width="18" height="126" fill="${METAL_LIGHT}" opacity="0.85"/>
    <rect x="306" y="292" width="38" height="34" rx="5" fill="${ACCENT}"/>
    <path d="M325 326 l0 34" stroke="#FF5B5B" stroke-width="3" opacity="0.85"/>
    <circle cx="325" cy="362" r="7" fill="#FF5B5B" opacity="0.5" filter="url(#glow)"/>
    <rect x="196" y="392" width="120" height="30" rx="5" fill="#151A2B"/>
    ${line(210, 402, 60)}${line(210, 411, 84, 0.5)}
    ${knob(556, 407, 15)}${knob(508, 407, 15)}`,

  "Fabrication Support": `
    ${shadow(400, 448, 130)}
    <rect x="314" y="180" width="172" height="128" rx="16" fill="url(#body)"/>
    <circle cx="368" cy="244" r="26" fill="#0E1322"/>
    <circle cx="368" cy="244" r="15" fill="url(#glass)"/>
    <circle cx="362" cy="238" r="5" fill="${SCREEN}" opacity="0.6"/>
    <circle cx="432" cy="244" r="18" fill="#0E1322"/>
    <circle cx="432" cy="244" r="9" fill="${ACCENT}" opacity="0.85"/>
    <rect x="372" y="308" width="56" height="66" rx="8" fill="url(#metal)"/>
    <rect x="336" y="374" width="128" height="26" rx="8" fill="url(#body)"/>
    <path d="M314 232 l-52 -34 M486 232 l52 -34" stroke="${SCREEN}" stroke-width="3" opacity="0.45" stroke-dasharray="6 7"/>`,

  "Test & Measurement": `
    ${shadow(400, 434, 168)}
    <rect x="196" y="176" width="408" height="248" rx="14" fill="url(#body)"/>
    <rect x="216" y="196" width="268" height="176" rx="8" fill="#0B1220"/>
    <rect x="228" y="208" width="244" height="152" rx="4" fill="url(#glass)"/>
    ${grid(228, 208, 244, 152, 7, 5)}
    <path d="M240 300 q28 -66 56 0 t56 0 t56 0 t56 0" fill="none" stroke="${SCREEN}" stroke-width="3.5"/>
    <path d="M240 330 l28 0 l0 -34 l28 0 l0 34 l28 0 l0 -34 l28 0 l0 34 l28 0 l0 -34 l28 0 l0 34 l28 0"
          fill="none" stroke="#F2C14E" stroke-width="2.6" opacity="0.75"/>
    ${knob(534, 236, 22)}${knob(534, 306, 18)}
    <rect x="504" y="346" width="60" height="12" rx="6" fill="${METAL}" opacity="0.7"/>
    <rect x="216" y="384" width="180" height="24" rx="6" fill="#151A2B"/>
    ${line(230, 393, 44)}${line(284, 393, 62, 0.5)}
    <circle cx="440" cy="396" r="9" fill="${ACCENT}"/>
    <circle cx="470" cy="396" r="9" fill="#3FBF7F"/>`,

  "Soldering & Rework": `
    ${shadow(400, 446, 172)}
    <rect x="196" y="252" width="252" height="180" rx="12" fill="url(#body)"/>
    <rect x="216" y="272" width="140" height="72" rx="6" fill="#0B1220"/>
    <text x="286" y="322" font-family="DejaVu Sans, Helvetica, Arial, sans-serif" font-size="38" font-weight="700"
          fill="${SCREEN}" text-anchor="middle">350</text>
    ${knob(400, 308, 26)}
    <rect x="216" y="366" width="212" height="44" rx="8" fill="#151A2B"/>
    <circle cx="244" cy="388" r="9" fill="#3FBF7F"/>
    <circle cx="276" cy="388" r="9" fill="#F2C14E" opacity="0.8"/>
    <path d="M448 300 q86 -18 128 34" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
    <rect x="556" y="308" width="86" height="22" rx="11" fill="url(#body)" transform="rotate(28 556 308)"/>
    <path d="M614 356 l28 32" stroke="${METAL_LIGHT}" stroke-width="7" stroke-linecap="round"/>
    <path d="M640 386 l12 14" stroke="${WARM}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="654" cy="402" r="8" fill="#FF7B4A" opacity="0.55" filter="url(#glow)"/>`,

  "Robotics Platforms": `
    ${shadow(400, 452, 150)}
    <rect x="318" y="404" width="164" height="34" rx="10" fill="url(#body)"/>
    <rect x="356" y="330" width="88" height="80" rx="10" fill="url(#metal)"/>
    <rect x="374" y="238" width="52" height="102" rx="12" fill="url(#body)" transform="rotate(-16 400 290)"/>
    <rect x="404" y="176" width="46" height="96" rx="12" fill="url(#metal)" transform="rotate(28 427 224)"/>
    <circle cx="400" cy="336" r="19" fill="${ACCENT}"/>
    <circle cx="400" cy="336" r="8" fill="${METAL_LIGHT}"/>
    <circle cx="382" cy="242" r="16" fill="${ACCENT}"/>
    <path d="M470 190 l40 26 l-14 22 l-40 -26 z" fill="url(#body)"/>
    <path d="M504 236 l26 16 M518 228 l24 14" stroke="${METAL_LIGHT}" stroke-width="6" stroke-linecap="round"/>
    <circle cx="352" cy="422" r="7" fill="${SCREEN}" opacity="0.8"/>
    <circle cx="376" cy="422" r="7" fill="#3FBF7F" opacity="0.8"/>`,

  "Industrial Control": `
    ${shadow(400, 442, 176)}
    <rect x="188" y="164" width="424" height="268" rx="12" fill="url(#metal)"/>
    <rect x="206" y="182" width="388" height="232" rx="8" fill="#E9EBF2"/>
    <rect x="222" y="198" width="200" height="70" rx="6" fill="url(#body)"/>
    <rect x="236" y="212" width="172" height="42" rx="4" fill="#0B1220"/>
    ${line(248, 224, 92)}${line(248, 234, 130, 0.55)}${line(248, 244, 64, 0.4)}
    ${[0, 1, 2, 3].map((i) => `<rect x="${222 + i * 48}" y="286" width="34" height="60" rx="5" fill="${INK}" opacity="0.9"/><circle cx="${239 + i * 48}" cy="300" r="7" fill="${i % 2 ? "#3FBF7F" : "#F2C14E"}"/>`).join("")}
    <rect x="440" y="198" width="146" height="148" rx="8" fill="#D4D8E4"/>
    ${[0, 1, 2].map((r) => [0, 1, 2].map((c) => `<circle cx="${470 + c * 42}" cy="${228 + r * 44}" r="14" fill="${INK_DARK}" opacity="0.85"/><circle cx="${470 + c * 42}" cy="${228 + r * 44}" r="8" fill="${["#FF5B5B", "#3FBF7F", "#F2C14E"][(r + c) % 3]}" opacity="0.9"/>`).join("")).join("")}
    <rect x="222" y="362" width="364" height="34" rx="6" fill="${METAL}" opacity="0.5"/>`,

  Workstations: `
    ${shadow(400, 446, 178)}
    <rect x="176" y="150" width="448" height="256" rx="12" fill="url(#body)"/>
    <rect x="192" y="166" width="416" height="224" rx="6" fill="#0B1220"/>
    <rect x="206" y="180" width="388" height="196" rx="4" fill="url(#glass)"/>
    ${grid(206, 180, 388, 196, 8, 5)}
    <path d="M358 224 l86 40 l-86 56 l-86 -40 z" fill="${SCREEN}" opacity="0.14"/>
    <path d="M358 224 l86 40 l0 46 l-86 42 l-86 -40 l0 -48 z" fill="none" stroke="${SCREEN}" stroke-width="2.6" opacity="0.8"/>
    <path d="M358 224 l0 128 M272 262 l86 40 M444 264 l-86 38" stroke="${ACCENT}" stroke-width="2.2" opacity="0.7" fill="none"/>
    <rect x="352" y="406" width="96" height="26" rx="4" fill="url(#metal)"/>
    <rect x="304" y="428" width="192" height="14" rx="7" fill="url(#body)"/>`,

  "Imaging & Display": `
    ${shadow(400, 440, 190)}
    <rect x="252" y="196" width="296" height="30" rx="6" fill="url(#metal)" opacity="0.8"/>
    <rect x="164" y="222" width="472" height="150" rx="10" fill="url(#body)"/>
    <rect x="182" y="240" width="436" height="90" rx="6" fill="#151A2B"/>
    <rect x="196" y="252" width="408" height="66" rx="4" fill="#F6F7FB"/>
    ${["#FF5B5B", "#F2C14E", "#3FBF7F", "#4A90E2", "#8A63D2"].map((c, i) => `<rect x="${214 + i * 78}" y="264" width="62" height="42" rx="3" fill="${c}" opacity="0.85"/>`).join("")}
    <rect x="182" y="340" width="436" height="22" rx="5" fill="#0E1322"/>
    <rect x="196" y="372" width="408" height="42" rx="6" fill="url(#metal)"/>
    <path d="M240 372 v42 M320 372 v42 M400 372 v42 M480 372 v42 M560 372 v42" stroke="#FFF" stroke-width="2" opacity="0.35"/>`,

  "Power Tools": `
    ${shadow(400, 452, 138)}
    <rect x="358" y="392" width="180" height="46" rx="8" fill="url(#body)"/>
    <rect x="380" y="378" width="136" height="16" rx="4" fill="url(#metal)" opacity="0.8"/>
    <rect x="394" y="176" width="34" height="230" rx="6" fill="url(#metal)"/>
    <rect x="352" y="164" width="150" height="72" rx="12" fill="url(#body)"/>
    <circle cx="470" cy="200" r="18" fill="${ACCENT}"/>
    <rect x="404" y="236" width="42" height="86" rx="8" fill="url(#metal)"/>
    <path d="M425 322 l0 44" stroke="${METAL_LIGHT}" stroke-width="9" stroke-linecap="round"/>
    <path d="M418 366 l14 0 l-7 22 z" fill="${INK}"/>
    <path d="M502 200 l58 -18" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="566" cy="180" r="12" fill="url(#metal)"/>
    <circle cx="372" cy="196" r="9" fill="#FF5B5B" opacity="0.85"/>`,

  "Hand Tools": `
    ${shadow(400, 448, 176)}
    <rect x="176" y="386" width="448" height="46" rx="8" fill="url(#wood)"/>
    <rect x="176" y="386" width="448" height="12" rx="6" fill="#E6BC8A" opacity="0.6"/>
    <path d="M232 200 l0 150 M216 200 l32 0" stroke="url(#metal)" stroke-width="16" stroke-linecap="round"/>
    <rect x="220" y="336" width="24" height="52" rx="6" fill="${ACCENT}"/>
    <path d="M318 214 q34 -22 60 6 l-32 26 z" fill="url(#metal)"/>
    <path d="M346 246 l-26 122" stroke="url(#metal)" stroke-width="14" stroke-linecap="round"/>
    <rect x="308" y="356" width="30" height="34" rx="6" fill="#C0392B"/>
    <circle cx="430" cy="234" r="28" fill="none" stroke="${METAL}" stroke-width="13"/>
    <path d="M444 258 l30 108" stroke="url(#metal)" stroke-width="13" stroke-linecap="round"/>
    <rect x="462" y="352" width="28" height="38" rx="6" fill="${ACCENT}"/>
    <path d="M540 212 l0 128 M524 212 l32 0 M524 340 l32 0" stroke="url(#metal)" stroke-width="12" stroke-linecap="round"/>
    <rect x="528" y="344" width="26" height="44" rx="6" fill="#C0392B"/>`,

  "Development Boards": `
    ${shadow(400, 424, 150)}
    <rect x="216" y="212" width="368" height="196" rx="12" fill="#1B6B4A"/>
    <rect x="230" y="226" width="340" height="168" rx="8" fill="#22855C"/>
    <rect x="286" y="252" width="112" height="66" rx="4" fill="${INK_DARK}"/>
    ${Array.from({ length: 8 }, (_, i) => `<rect x="278" y="${258 + i * 8}" width="8" height="3" fill="${METAL_LIGHT}"/><rect x="398" y="${258 + i * 8}" width="8" height="3" fill="${METAL_LIGHT}"/>`).join("")}
    <rect x="238" y="234" width="64" height="30" rx="4" fill="${METAL}"/>
    <rect x="504" y="234" width="56" height="34" rx="4" fill="${METAL}"/>
    ${Array.from({ length: 14 }, (_, i) => `<rect x="${244 + i * 22}" y="352" width="12" height="16" rx="2" fill="${INK_DARK}"/>`).join("")}
    ${Array.from({ length: 10 }, (_, i) => `<rect x="${300 + i * 22}" y="330" width="12" height="14" rx="2" fill="${INK_DARK}" opacity="0.8"/>`).join("")}
    <circle cx="440" cy="286" r="8" fill="#F2C14E"/>
    <circle cx="468" cy="286" r="8" fill="#3FBF7F"/>
    <rect x="430" y="316" width="120" height="14" rx="3" fill="${INK_DARK}" opacity="0.45"/>`,

  Sensors: `
    ${shadow(400, 430, 140)}
    <rect x="272" y="252" width="256" height="152" rx="10" fill="#1B6B4A"/>
    <rect x="284" y="264" width="232" height="128" rx="6" fill="#22855C"/>
    <circle cx="346" cy="316" r="40" fill="${INK_DARK}"/>
    <circle cx="346" cy="316" r="30" fill="#2A3350"/>
    <circle cx="346" cy="316" r="14" fill="${METAL}"/>
    <circle cx="454" cy="316" r="40" fill="${INK_DARK}"/>
    <circle cx="454" cy="316" r="30" fill="#2A3350"/>
    <circle cx="454" cy="316" r="14" fill="${METAL}"/>
    <path d="M346 246 q54 -46 108 0" fill="none" stroke="${SCREEN}" stroke-width="3" opacity="0.5" stroke-dasharray="5 6"/>
    <path d="M330 214 q70 -58 140 0" fill="none" stroke="${SCREEN}" stroke-width="2.4" opacity="0.3" stroke-dasharray="5 6"/>
    ${Array.from({ length: 4 }, (_, i) => `<rect x="${330 + i * 24}" y="404" width="9" height="26" rx="2" fill="${METAL_LIGHT}"/>`).join("")}`,

  "Motors & Actuators": `
    ${shadow(400, 432, 140)}
    <rect x="336" y="196" width="50" height="18" rx="9" fill="url(#metal)"/>
    <circle cx="361" cy="240" r="26" fill="url(#metal)"/>
    <circle cx="361" cy="240" r="11" fill="${INK_DARK}"/>
    <rect x="286" y="256" width="150" height="122" rx="10" fill="${ACCENT}"/>
    <rect x="286" y="256" width="150" height="24" rx="10" fill="#3A48B0"/>
    <rect x="298" y="292" width="126" height="14" rx="4" fill="#0F1A5E" opacity="0.5"/>
    <rect x="298" y="316" width="126" height="14" rx="4" fill="#0F1A5E" opacity="0.5"/>
    <rect x="436" y="288" width="88" height="58" rx="8" fill="url(#body)"/>
    <circle cx="480" cy="317" r="20" fill="url(#metal)"/>
    <circle cx="480" cy="317" r="8" fill="${INK_DARK}"/>
    <path d="M286 344 l-46 22 M286 356 l-46 22 M286 368 l-46 22" stroke="${INK}" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
    <path d="M240 366 l-24 6" stroke="#C0392B" stroke-width="5" stroke-linecap="round"/>`,

  "Modules & Drivers": `
    ${shadow(400, 424, 148)}
    <rect x="236" y="230" width="328" height="172" rx="10" fill="#1B4E8A"/>
    <rect x="248" y="242" width="304" height="148" rx="6" fill="#2160A8"/>
    <rect x="248" y="242" width="304" height="10" rx="5" fill="#3A7FCC" opacity="0.5"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${266 + i * 74}" y="264" width="58" height="58" rx="5" fill="#0E1322"/><circle cx="${295 + i * 74}" cy="293" r="16" fill="${METAL}"/><circle cx="${295 + i * 74}" cy="293" r="7" fill="${INK_DARK}"/>`).join("")}
    ${[0, 1, 2, 3].map((i) => `<circle cx="${295 + i * 74}" cy="344" r="8" fill="${i < 2 ? "#3FBF7F" : "#F2C14E"}" opacity="0.9"/>`).join("")}
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${262 + i * 38}" y="384" width="11" height="22" rx="2" fill="${METAL_LIGHT}"/>`).join("")}`,

  "Prototyping Tools": `
    ${shadow(400, 430, 156)}
    <rect x="232" y="230" width="336" height="180" rx="10" fill="#F0F1F5" stroke="#C9CDDB" stroke-width="3"/>
    <rect x="248" y="252" width="304" height="12" rx="4" fill="#DDE0EA"/>
    <rect x="248" y="376" width="304" height="12" rx="4" fill="#DDE0EA"/>
    <path d="M400 288 v52" stroke="#C9CDDB" stroke-width="14"/>
    <g fill="#9AA1B8">
      ${Array.from({ length: 14 }, (_, c) => Array.from({ length: 5 }, (_, r) => `<circle cx="${262 + c * 21}" cy="${282 + r * 11}" r="2.6"/>`).join("")).join("")}
      ${Array.from({ length: 14 }, (_, c) => Array.from({ length: 5 }, (_, r) => `<circle cx="${262 + c * 21}" cy="${344 + r * 11}" r="2.6"/>`).join("")).join("")}
    </g>
    <path d="M290 300 q40 -40 84 0" fill="none" stroke="#C0392B" stroke-width="4" stroke-linecap="round"/>
    <path d="M400 356 q46 44 96 0" fill="none" stroke="#2160A8" stroke-width="4" stroke-linecap="round"/>
    <rect x="452" y="292" width="34" height="12" rx="3" fill="${WARM}"/>`,

  "Cables & Connectors": `
    ${shadow(400, 436, 160)}
    <path d="M228 300 q80 -110 176 -20 t176 -30" fill="none" stroke="${INK}" stroke-width="17" stroke-linecap="round"/>
    <path d="M228 300 q80 -110 176 -20 t176 -30" fill="none" stroke="#3A4160" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
    <rect x="182" y="278" width="60" height="44" rx="7" fill="url(#metal)"/>
    <rect x="166" y="288" width="20" height="24" rx="4" fill="${METAL_LIGHT}"/>
    <rect x="562" y="228" width="62" height="44" rx="7" fill="url(#metal)"/>
    <rect x="620" y="238" width="20" height="24" rx="4" fill="${METAL_LIGHT}"/>
    <path d="M262 366 q92 62 190 -6 t166 24" fill="none" stroke="${ACCENT}" stroke-width="13" stroke-linecap="round" opacity="0.9"/>
    <rect x="228" y="348" width="46" height="36" rx="6" fill="${INK_DARK}"/>
    <rect x="602" y="368" width="46" height="36" rx="6" fill="${INK_DARK}"/>`,
};

/** A domain tile shows the machine most characteristic of that domain. */
const domainArt: Record<string, string> = {
  "Digital Fabrication": devices["3D Printing"]!,
  "Electronics & Embedded": devices["Test & Measurement"]!,
  "Robotics & Automation": devices["Robotics Platforms"]!,
  "Design & Simulation": devices["Workstations"]!,
  "Workshop & Materials": devices["Hand Tools"]!,
};

function frame(inner: string) {
  // The catalogue card lays a dark gradient over the bottom of the image so the
  // machine's name stays readable. Drawing centred put every device half behind
  // it, so the subject is lifted and eased back to sit in the clear upper area.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
${DEFS}
<rect width="800" height="600" fill="url(#sweep)"/>
<ellipse cx="400" cy="230" rx="420" ry="300" fill="url(#pool)"/>
<g transform="translate(400 300) scale(0.88) translate(-400 -300) translate(0 -58)">
${inner}
</g>
</svg>`;
}

export function categoryArt(category: string) {
  const art = devices[category];
  return art ? frame(art) : null;
}

/**
 * Domain tiles need a different composition from catalogue cards.
 *
 * They render at roughly a sixth of the size, under white text and a heavy dark
 * scrim. On the light studio backdrop the machine washed out to nothing, so the
 * tile uses a deep backdrop and a larger subject — the same drawing, staged for
 * a thumbnail rather than a product shot.
 */
export function domainTile(domain: string) {
  const art = domainArt[domain];
  if (!art) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
${DEFS}
<defs>
  <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#2E3762"/>
    <stop offset="55%" stop-color="#1E2547"/>
    <stop offset="100%" stop-color="#141931"/>
  </linearGradient>
  <radialGradient id="tilePool" cx="46%" cy="34%" r="66%">
    <stop offset="0%" stop-color="#6E7BC4" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="#6E7BC4" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="800" height="600" fill="url(#tile)"/>
<ellipse cx="368" cy="204" rx="420" ry="300" fill="url(#tilePool)"/>
<g transform="translate(400 300) scale(1.18) translate(-400 -300) translate(0 -78)">
${art}
</g>
</svg>`;
}

export const coveredCategories = Object.keys(devices);
export const coveredDomains = Object.keys(domainArt);
