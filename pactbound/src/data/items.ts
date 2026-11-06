export type ItemId = 'tonic' | 'draught' | 'remedy' | 'sigil' | 'silverSigil' | 'ravenCharm' | 'pactRibbon';

export type ItemKind = 'heal' | 'cure' | 'sigil' | 'key';

export interface ItemDef {
  name: string;
  kind: ItemKind;
  desc: string;
  /** HP restored by `heal` items. */
  heal?: number;
  /** Catch multiplier for `sigil` items. */
  catchMult?: number;
  /** Shop price in marks. Undefined means it is not sold. */
  price?: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  tonic: { name: 'Moonmilk Tonic', kind: 'heal', heal: 25, price: 60, desc: 'Warm milk steeped under a full moon. Restores 25 HP.' },
  draught: { name: 'Starlight Draught', kind: 'heal', heal: 60, price: 150, desc: 'Tastes like falling asleep happy. Restores 60 HP.' },
  remedy: { name: 'Honey Remedy', kind: 'cure', price: 80, desc: 'Soothes any ailment: scorch, blight, drowse or charm.' },
  sigil: { name: 'Pact Sigil', kind: 'sigil', catchMult: 1, price: 100, desc: 'A chalk sigil that offers a wild familiar your pact.' },
  silverSigil: { name: 'Silver Sigil', kind: 'sigil', catchMult: 1.6, desc: 'Inlaid with silver. Wild familiars find it hard to refuse.' },
  ravenCharm: { name: 'Raven Latch-Charm', kind: 'key', desc: 'A broken latch-charm stamped with a raven. You found it by the fountain.' },
  pactRibbon: { name: 'Silver Pact-Ribbon', kind: 'key', desc: "Lucien's gift. It is warm, as if it has a heartbeat of its own." },
};

export function item(id: ItemId): ItemDef {
  return ITEMS[id];
}

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
