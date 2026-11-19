// 機種データの入れ物。メーカーごとのファイル（panasonic.js など）が SEL.add({...}) で中身を足し、最後に app.js が SEL.finish() を呼ぶ。
// 値段・お客さんの名前は入れない（だれでも開けるURLに置くため）。
window.SEL = {
  version: "2026-11-19",
  models: {},   // 型式 → 中身
  succ: {},     // 既設の型式 → 後継の型式の並び（メーカーをまたいでもよい）
  sources: {},  // メーカー → 出どころの並び
  lineups: {},  // 名前 → 小さい順の型式の並び（能力が足りない時に1つ上を選ぶ）
  makers: [],
  _variants: [], _extends: [],
  add(pkg) {
    const maker = pkg.maker;
    if (maker && !this.makers.includes(maker)) this.makers.push(maker);
    for (const [id, m] of Object.entries(pkg.models || {})) this.models[id] = Object.assign({ maker }, m);
    for (const [id, over] of Object.entries(pkg.extend || {})) this._extends.push([id, over]);
    this._variants.push(...(pkg.variants || []));
    for (const [old, list] of Object.entries(pkg.succ || {})) {
      const a = this.succ[old] || (this.succ[old] = []);
      list.forEach((x) => { if (!a.includes(x)) a.push(x); });
    }
    Object.assign(this.lineups, pkg.lineups || {});
    if (pkg.sources) this.sources[maker] = (this.sources[maker] || []).concat(pkg.sources);
  },
  // 補足（extend）を元の型式に足してから、塩害仕様などの型式を作る
  finish() {
    for (const [id, over] of this._extends) {
      if (!this.models[id]) { console.warn("補足する型式がありません", id); continue; }
      const m = this.models[id];
      for (const [k, v] of Object.entries(over)) m[k] = Array.isArray(v) && Array.isArray(m[k]) ? m[k].concat(v) : v;
    }
    for (const v of this._variants) {
      const base = this.models[v.of];
      if (!base) { console.warn("元の型式がありません", v.of); continue; }
      this.models[v.id] = Object.assign({}, base, v.over || {}, { saltOf: v.of, salt: null });
    }
    // 型式 → 入っている並び
    this.lineOf = {};
    for (const [name, list] of Object.entries(this.lineups)) list.forEach((id, i) => { this.lineOf[id] = { name, i }; });
  }
};
