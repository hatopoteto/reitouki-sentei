// 機種データの入れ物。メーカーごとのファイル（panasonic.js など）が SEL.add({...}) で中身を足す。
// 値段・お客さんの名前は入れない（だれでも開けるURLに置くため）。
window.SEL = {
  version: "2026-11-19",
  models: {},   // 型式 → 中身
  succ: {},     // 既設の型式 → 後継の型式の並び（メーカーをまたいでもよい）
  sources: {},  // メーカー → 出どころの並び
  makers: [],
  add(pkg) {
    const maker = pkg.maker;
    if (maker && !this.makers.includes(maker)) this.makers.push(maker);
    for (const [id, m] of Object.entries(pkg.models || {})) this.models[id] = Object.assign({ maker }, m);
    // 塩害仕様など、元の型式の中身を引き継ぐ型式
    for (const v of pkg.variants || []) {
      const base = this.models[v.of];
      if (!base) { console.warn("元の型式がありません", v.of); continue; }
      this.models[v.id] = Object.assign({}, base, v.over || {}, { saltOf: v.of, salt: null });
    }
    for (const [old, list] of Object.entries(pkg.succ || {})) {
      const a = this.succ[old] || (this.succ[old] = []);
      list.forEach((x) => { if (!a.includes(x)) a.push(x); });
    }
    if (pkg.sources) this.sources[maker] = (this.sources[maker] || []).concat(pkg.sources);
  }
};
