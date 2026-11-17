// 3D 样机布势数据生成：开局 13 省代表性驻军（带 factionId/templateId/supportKind 供样机选自有模型变体）
import { createInitialState } from "../src/state/createInitialState";
import { PROVINCE_MAP } from "../src/data/provinces";
import { FACTIONS } from "../src/data/factions";
import { TEMPLATES, SUPPORTS } from "../src/data/units";
import { neighborsOf, isSeaEdge } from "../src/core/mapGraph";
import { writeFileSync } from "node:fs";

const s = createInitialState({ seed: 42, playerFactionId: "roc" });
const PROVS = ["nanjing", "beiping", "shanghai", "taiyuan", "shijiazhuang", "wuhan", "xian",
  "tokyo", "osaka", "vladivostok", "chita", "guam", "manila"];
const ICONS: Record<string, string> = { infantry: "步", mountain: "山", cavalry: "骑", motorized: "摩", armor: "坦", marine: "陆", garrison: "守", guerrilla: "游" };
const out = [];
for (const pid of PROVS) {
  const def = PROVINCE_MAP[pid]!;
  const items: unknown[] = [];
  for (const d of s.divisions.filter((x) => x.provinceId === pid)) {
    const tpl = TEMPLATES[d.templateId]!;
    const kind = tpl.cls === "armor" ? "tank" : tpl.cls === "motorized" ? "truck" : tpl.cls === "cavalry" ? "cavalry" : "soldier";
    items.push({
      kind, factionId: d.factionId, templateId: d.templateId,
      label: `${tpl.name} ${(d.strength / 10000).toFixed(1)}万`, icon: ICONS[tpl.cls] ?? "步",
    });
  }
  for (const sup of s.supports.filter((x) => x.provinceId === pid)) {
    if (sup.kind === "fleet") {
      const seaNb = neighborsOf(pid).find((nb) => isSeaEdge(pid, nb));
      let anchor: [number, number] = [def.cx + 18, def.cy + 10];
      if (seaNb) {
        const nd = PROVINCE_MAP[seaNb]!;
        const dx = nd.cx - def.cx, dy = nd.cy - def.cy;
        const len = Math.hypot(dx, dy) || 1;
        anchor = [Math.round((def.cx + (dx / len) * 30) * 10) / 10, Math.round((def.cy + (dy / len) * 30) * 10) / 10];
      }
      items.push({ kind: "ship", factionId: sup.factionId, supportKind: "fleet", label: SUPPORTS[sup.kind].name, icon: "舰", anchor });
    } else {
      items.push({
        kind: "plane", factionId: sup.factionId, supportKind: sup.kind,
        label: SUPPORTS[sup.kind].name, icon: sup.kind === "bomber" ? "轰" : "机",
      });
    }
  }
  if (items.length === 0) continue;
  const owner = s.provinces[pid]!.ownerId;
  const f = FACTIONS[owner as keyof typeof FACTIONS];
  out.push({ province: pid, name: def.name, cx: def.cx, cy: def.cy, faction: f?.name ?? owner, color: f?.colorHex ?? "#888888", items });
}
writeFileSync(new URL("../../terrain3d-demo/public/units.json", import.meta.url), JSON.stringify(out, null, 1));
console.log("provinces:", out.length, "items:", out.reduce((a, p) => a + (p.items as unknown[]).length, 0));
for (const p of out) console.log(p.province, (p.items as Array<{ kind: string; factionId: string; label: string }>).map((i) => `${i.kind}:${i.factionId}:${i.label}`).join(" | "));
