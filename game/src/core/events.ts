// 历史事件解释器：END_TURN 进入新月份时触发当月未触发事件，效果全部结构化落状态。
// 1945 年后事件表为空，战争按胜负条件继续（data/events.ts 口径）。

import { EVENTS, type EventEffect} from "../data/events";
import { FACTIONS} from "../data/factions";
import { relationPairKey} from "../data/diplomacy";
import { TEMPLATES} from "../data/units";
import { clampPercent} from "./guards";
import { pushLog} from "./relations";
import type { GameState} from "../state/types";

function removePair(list: string[], a: string, b: string): string[] {
const key = relationPairKey(a, b);
return list.filter((k) => k!== key);
}

function addPair(list: string[], a: string, b: string): void {
const key = relationPairKey(a, b);
if (!list.includes(key)) list.push(key);
}

export function activateFaction(draft: GameState, factionId: string): void {
const f = draft.factions[factionId];
const def = FACTIONS[factionId as keyof typeof FACTIONS];
if (!f ||!def || f.active) return;
f.active = true;
f.alive = true;
// 汪伪：南京/上海/杭州若在日本手中则移交（傀儡政权口径）
if (factionId === "wangjingwei") {
for (const pid of ["nanjing", "shanghai", "hangzhou"]) {
if (draft.provinces[pid]?.ownerId === "japan") {
draft.provinces[pid].ownerId = "wangjingwei";
}
}
addPair(draft.alliances, "wangjingwei", "japan");
}
if (factionId === "mengjiang") {
// 蒙疆：察哈尔/绥远本部自地方军阀（或国民政府）手中移交
for (const pid of ["hohhot", "baotou", "zhangjiakou", "duolun"]) {
const owner = draft.provinces[pid]?.ownerId;
if (owner === "warlords" || owner === "roc") {
draft.provinces[pid].ownerId = "mengjiang";
}
}
addPair(draft.alliances, "mengjiang", "japan");
}
if (factionId === "bna") addPair(draft.alliances, "bna", "japan");
if (factionId === "ina") addPair(draft.alliances, "ina", "japan");
for (const d of def.initialDivisions) {
const tpl = TEMPLATES[d.templateId]!;
draft.divisions.push({
id: `div-${draft.nextId++}`,
factionId,
templateId: d.templateId,
provinceId: d.provinceId,
strength: d.strength?? tpl.fullStrength,
movedTurn: draft.turn,
staticMonths: 0, org: 100,
});
}
for (const s of def.initialSupports) {
draft.supports.push({
id: `sup-${draft.nextId++}`, factionId, kind: s.kind, provinceId: s.provinceId, missionTargetId: s.provinceId,
});
}
}

function applyEffect(draft: GameState, e: EventEffect): void {
switch (e.kind) {
case "declareWar": {
addPair(draft.wars, e.a, e.b);
draft.alliances = removePair(draft.alliances, e.a, e.b);
draft.tradePacts = removePair(draft.tradePacts, e.a, e.b);
draft.nonAggression = removePair(draft.nonAggression, e.a, e.b);
draft.relations[relationPairKey(e.a, e.b)] = 0;
break;
}
case "endWar":
draft.wars = removePair(draft.wars, e.a, e.b);
break;
case "relation": {
const key = relationPairKey(e.a, e.b);
draft.relations[key] = clampPercent((draft.relations[key]?? 50) + e.delta);
break;
}
case "transfer": {
const prov = draft.provinces[e.provinceId];
if (prov) prov.ownerId = e.to;
break;
}
case "activate":
activateFaction(draft, e.factionId);
break;
case "addEquipment": {
const f = draft.factions[e.factionId];
if (f) f.stockpile.equipment = Math.max(0, f.stockpile.equipment + e.amount);
break;
}
case "addResource": {
const f = draft.factions[e.factionId];
if (f) f.stockpile[e.resource] = Math.max(0, f.stockpile[e.resource] + e.amount);
break;
}
case "stability": {
const f = draft.factions[e.factionId];
if (f) f.stability = clampPercent(f.stability + e.delta);
break;
}
case "warSupport": {
const f = draft.factions[e.factionId];
if (f) f.warSupport = clampPercent(f.warSupport + e.delta);
break;
}
case "alliance":
addPair(draft.alliances, e.a, e.b);
break;
case "damageAt": {
for (const div of draft.divisions) {
if (div.factionId === e.factionId && div.provinceId === e.provinceId) {
div.strength = Math.max(100, Math.floor(div.strength * (1 - e.ratio)));
}
}
break;
}
}
}

function conditionMet(draft: GameState, ev: (typeof EVENTS)[number]): boolean {
const c = ev.condition;
if (!c) return true;
if (c.notAtWar && draft.wars.includes(relationPairKey(c.notAtWar[0], c.notAtWar[1]))) return false;
if (c.atWar && !draft.wars.includes(relationPairKey(c.atWar[0], c.atWar[1]))) return false;
if (c.ownerIs && draft.provinces[c.ownerIs.provinceId]?.ownerId !== c.ownerIs.ownerId) return false;
return true;
}

export function fireDueEvents(draft: GameState): void {
for (const ev of EVENTS) {
if (ev.year === draft.year && ev.month === draft.month &&!draft.firedEvents.includes(ev.id)) {
draft.firedEvents.push(ev.id);
if (!conditionMet(draft, ev)) {
// 史实分岔：玩家已改动历史，本事件不再发生（仍标记已触发，防迟发）
pushLog(draft, "event", `【史实分岔】${ev.title}：因当前局势与史实不同，未发生。`);
continue;
}
for (const e of ev.effects) applyEffect(draft, e);
pushLog(draft, "event", `【${ev.title}】${ev.text}`);
}
}
}
