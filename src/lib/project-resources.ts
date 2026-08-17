const consumableNames = new Set([
  "PLA Filament",
  "Acrylic Sheets",
  "MDF Board",
  "Jumper Wires",
  "PCB Blanks",
]);

export function splitResourceSelection(selected: string[]) {
  return {
    equipment: selected.filter((item) => !consumableNames.has(item)),
    consumables: selected.filter((item) => consumableNames.has(item)),
  };
}
