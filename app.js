// 冷凍冷蔵の選定：既設の型式 → 後継の組合せ・能力のくらべ・確かめること
(() => {
  const SEL = window.SEL; SEL.finish(); const M = SEL.models; const SUCC = SEL.succ;
  const KIND_ORDER = ["冷凍機", "クーラー", "吸込みフード", "吹出しダンパー", "コントローラー", "フィルター", "膨張弁", "電磁弁", "警報"];
  // 例（お客さんの名前は入れない）
  const PRESETS = [
    { id: "p1", label: "-20℃ 保冷庫・パナ 6馬力", olds: [["OCU-NS600FS", 1], ["CC-D6020LH", 1], ["SECT-C2300", 1]], troom: -20, pipe: 80, hz: 50, salt: false },
    { id: "p2", label: "-15℃ 冷凍庫・日立 6馬力・UC 2台", olds: [["KX-R6A1", 1], ["US-R4LH1", 2]], troom: -15, pipe: 65, hz: 50, salt: true, maker: "三菱電機" }
  ].filter((p) => p.olds.every(([m]) => M[m]));

  // ───── 状態（この端末にだけ残す） ─────
  const S = { olds: [], troom: -20, pipe: 30, hz: 50, salt: false, maker: "", opts: {}, preset: "" };
  const KEY = "sentei-state-v1";
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function restore() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!v || !Array.isArray(v.olds)) return false;
      Object.assign(S, v); S.olds = S.olds.filter((o) => M[o.model] && SUCC[o.model]);
      return true;
    } catch (e) { return false; }
  }

  const $ = (id) => document.getElementById(id);
  const kw = (v) => v.toFixed(2);
  const norm = (s) => s.normalize("NFKC").toUpperCase().replace(/\s+/g, "").replace(/[‐－―ー−]/g, "-");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ───── 計算 ─────
  // pts: [[x,y],...] を直線でつなぎ、外は両端の傾きでのばす。1点だけなら原点を通る直線
  function lerp(pts, x) {
    if (pts.length === 1) return pts[0][1] * x / pts[0][0];
    const p = pts.slice().sort((a, b) => a[0] - b[0]);
    let i = 0; while (i < p.length - 2 && x > p[i + 1][0]) i++;
    const [x0, y0] = p[i], [x1, y1] = p[i + 1];
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  function ucCap(id, td) { const u = M[id].uc; const t = (S.hz === 60 && u.td60) ? u.td60 : u.td; return lerp(t, td); }
  // 冷凍機の能力を蒸発温度 te で読む。2点以上の表が無ければ null
  //   table … 配管長別の表（三菱など）／ rows … 蒸発温度ごとの表。cols: hz=50Hz・60Hz、range=定格〜最大（インバーター）、single=最大運転の1列
  function cuCurve(id, te) {
    const c = M[id].cu || {};
    const out = (tes) => te < Math.min(...tes) - 0.01 || te > Math.max(...tes) + 0.01;
    if (c.table) {
      const t = c.table; const L = S.pipe; const Lc = Math.min(Math.max(L, t.L[0]), t.L[t.L.length - 1]);
      const pts = t.rows.map((r) => [r.te, lerp(t.L.map((l, i) => [l, r.kw[i]]), Lc)]);
      return { kw: lerp(pts, te), outside: out(pts.map((p) => p[0])), clamped: L !== Lc };
    }
    if (c.rows && c.rows.length >= 2) {
      const tes = c.rows.map((r) => r[0]);
      const col = (i) => lerp(c.rows.map((r) => [r[0], r[i]]), te);
      if (c.cols === "hz") return { kw: col(S.hz === 60 ? 2 : 1), outside: out(tes) };
      if (c.cols === "range") return { kw: col(1), max: col(2), outside: out(tes) };
      return { kw: col(1), outside: out(tes) };
    }
    return null;
  }
  // 冷凍機とクーラーが釣り合う蒸発温度。which=max ならインバーターの最大側で
  function balance(cuId, ucId, n, which) {
    const q = (te) => { const v = cuCurve(cuId, te); return which === "max" && v.max ? v.max : v.kw; };
    const f = (te) => q(te) - n * ucCap(ucId, S.troom - te);
    let lo = -50, hi = S.troom - 0.5;
    if (!(f(lo) * f(hi) <= 0)) return null;
    for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
    const te = (lo + hi) / 2;
    return { te, td: S.troom - te, kw: n * ucCap(ucId, S.troom - te), outside: cuCurve(cuId, te).outside };
  }
  // いちばん出せる能力（インバーターは最大側）
  const topKw = (v) => (v.max || v.kw);

  // ───── 組合せを作る ─────
  function pickSucc(old) {
    const list = SUCC[old] || [];
    const hit = list.find((m) => M[m] && M[m].maker === S.maker) || list.find((m) => M[m]);
    if (!hit) return null;
    return (S.salt && M[hit].salt && M[M[hit].salt]) ? M[hit].salt : hit;
  }
  function makers() {
    const set = [];
    S.olds.forEach((o) => { const l = (SUCC[o.model] || []).filter((m) => M[m]); if (l.length > 1) l.forEach((m) => { if (!set.includes(M[m].maker)) set.push(M[m].maker); }); });
    return set;
  }
  function compose() {
    const out = [];
    const put = (row) => { const e = out.find((r) => r.model === row.model); if (e) { e.qty = Math.max(e.qty, row.qty); e.old = e.old || row.old; } else out.push(row); };
    S.olds.forEach((o) => {
      let m = pickSucc(o.model); if (!m) return;
      // 冷凍機：同じ馬力で能力が既設に届かない時は、同じ並びの1つ上へ（3つまで）
      let stepped = null;
      if (M[m].kind === "冷凍機" && m !== o.model) {
        const te = S.troom - 10; const ov = cuCurve(o.model, te);
        const base0 = M[m].saltOf || m; const line = SEL.lineOf[base0];
        if (ov && line) {
          let base = base0; let i = line.i;
          for (let k = 0; k < 3; k++) {
            const nv = cuCurve(base, te);
            if (!nv || topKw(nv) + 1e-9 >= topKw(ov)) break;
            const next = SEL.lineups[line.name][i + 1]; if (!next) break;
            base = next; i++;
          }
          if (base !== base0) { stepped = base0; m = (S.salt && M[base].salt && M[M[base].salt]) ? M[base].salt : base; }
        }
      }
      put({ model: m, old: o.model, qty: o.qty, stepped });
      const base = M[m].saltOf || m;
      (M[base].addons || []).forEach((a) => { if (M[a.m]) put({ model: a.m, old: null, qty: a.per === "unit" ? o.qty : 1 }); });
    });
    const options = [];
    out.slice().forEach((r) => (M[r.model].options || []).forEach((op) => { if (!M[op.m]) return; options.push(op); if (S.opts[op.m]) put({ model: op.m, old: null, qty: 1 }); }));
    const rank = (k) => { const i = KIND_ORDER.indexOf(k); return i < 0 ? 99 : i; };
    out.sort((a, b) => rank(M[a.model].kind) - rank(M[b.model].kind));
    return { items: out, options };
  }

  // 冷凍機1台の能力を、蒸発温度 te で読む
  function cuAt(id, te) {
    const c = M[id].cu;
    if (!c || c.unknown) return { unknown: true };
    const v = cuCurve(id, te);
    if (v) return { kw: v.kw, max: v.max, note: c.cond + (c.label ? `（${c.label}）` : "") + (v.outside ? "。この蒸発温度は表の外なので、直線でのばした値" : "") + (v.clamped ? "。配管長は表の端の値" : "") };
    if (c.point.te === te) return { kw: c.point.kw, max: c.point.kwMax, note: c.cond };
    return { kw: c.point.kw, max: c.point.kwMax, other: true, note: c.cond };
  }

  function capacity(items) {
    const te = S.troom - 10;
    const res = { rows: [], verdict: "ok" };
    const rankS = { ok: 0, warn: 1, bad: 2 };
    const worse = (st) => { if (rankS[st] > rankS[res.verdict]) res.verdict = st; };
    const cuNew = items.find((r) => M[r.model].kind === "冷凍機");
    const ucNew = items.find((r) => M[r.model].kind === "クーラー");
    const cuOld = S.olds.find((o) => M[o.model].kind === "冷凍機");
    const ucOld = S.olds.find((o) => M[o.model].kind === "クーラー");

    if (cuNew) {
      const row = { title: "冷凍機", bars: [], notes: [], state: "ok" };
      const vo = cuOld ? cuAt(cuOld.model, te) : null; const vn = cuAt(cuNew.model, te);
      if (vo) row.bars.push(Object.assign({ who: "既設", model: cuOld.model }, vo));
      row.bars.push(Object.assign({ who: "新", model: cuNew.model, isNew: true }, vn));
      if (!vo) { row.state = "warn"; row.notes.push("既設の冷凍機が入っていません"); }
      else if (vo.unknown) { row.state = "warn"; row.notes.push(`既設 ${cuOld.model} の能力が分かりません。メーカーへの照会で確かめます`); }
      else if (vn.unknown) { row.state = "warn"; row.notes.push(`${cuNew.model} の能力が入っていません`); }
      else if (vo.other || vn.other) { row.state = "warn"; row.notes.push(`仕様書の値が、庫内 ${S.troom}℃（蒸発 ${te}℃）とは別の条件です。くらべるには、同じ条件の値が要ります`); }
      else if (topKw(vn) + 1e-9 < topKw(vo)) { row.state = "bad"; row.notes.push("新の能力が既設を下回ります"); }
      else if (vn.max && vn.kw + 1e-9 < topKw(vo)) {
        row.state = "warn";
        const line = SEL.lineOf[M[cuNew.model].saltOf || cuNew.model]; const next = line && SEL.lineups[line.name][line.i + 1];
        row.notes.push(`既設の能力に届くのは、インバーターの最大側だけです（定格側は ${kw(vn.kw)} kW）。${next ? `余裕を見るなら、1つ上の ${next} も候補です` : "余裕は少なめです"}`);
      }
      const m = M[cuNew.model];
      if (cuNew.stepped) row.notes.push(`同じ馬力の ${cuNew.stepped} では既設の能力に届かないので、1つ上の ${cuNew.model} にしました`);
      if (m.pipeMax && S.pipe > m.pipeMax) { row.state = "bad"; row.notes.push(`配管 ${S.pipe}m は最大配管長 ${m.pipeMax}m を超えています`); }
      if (m.te && (te < m.te[0] || te > m.te[1])) { row.state = "bad"; row.notes.push(`蒸発 ${te}℃ は ${cuNew.model} の蒸発温度範囲（${m.te[0]}〜${m.te[1]}℃）の外です`); }
      if (cuCurve(cuNew.model, te) && ucNew && M[ucNew.model].uc) {
        row.balance = balance(cuNew.model, ucNew.model, ucNew.qty, "kw");
        if (vn.max && row.balance) row.balanceMax = balance(cuNew.model, ucNew.model, ucNew.qty, "max");
      }
      worse(row.state); res.rows.push(row);
    }
    if (ucNew && M[ucNew.model].uc) {
      const row = { title: "クーラー", bars: [], notes: [], state: "ok" };
      const n = ucNew.qty; const on = ucOld ? ucOld.qty : n;
      if (ucOld && M[ucOld.model].uc) row.bars.push({ who: "既設", model: ucOld.model + (on > 1 ? ` ×${on}` : ""), kw: on * ucCap(ucOld.model, 10), est: M[ucOld.model].uc.est });
      row.bars.push({ who: "新", model: ucNew.model + (n > 1 ? ` ×${n}` : ""), kw: n * ucCap(ucNew.model, 10), isNew: true });
      const hzNote = S.hz === 60 && !M[ucNew.model].uc.td60 ? "（60Hz の値が無いので 50Hz の値）" : "";
      row.cond = `温度差 10℃・${S.hz}Hz${hzNote}。台数分の合計`;
      if (!ucOld) { row.state = "warn"; row.notes.push("既設のクーラーが入っていません"); }
      else if (!M[ucOld.model].uc) { row.state = "warn"; row.notes.push(`既設 ${ucOld.model} の能力が分かりません`); }
      else if (row.bars[1].kw + 1e-9 < row.bars[0].kw) { row.state = "bad"; row.notes.push("新の能力が既設を下回ります"); }
      else if (M[ucOld.model].uc.est) row.notes.push("既設の能力は推定の値です");
      worse(row.state); res.rows.push(row);
    }
    if (!res.rows.length) res.verdict = "warn";
    return res;
  }

  function checks(items) {
    const list = [];
    const add = (to, text) => { if (!list.some((c) => c.text === text)) list.push({ to, text }); };
    items.forEach((r) => {
      const m = M[r.model];
      (m.checks || []).forEach((c) => add(c.to, c.text));
      if (m.flag === "要確認" && m.memo) add(m.maker, `${r.model}：${m.memo}`);
      if (m.pipeTableMax && S.pipe > m.pipeTableMax) add(m.maker, `配管 ${S.pipe}m 相当で ${r.model} が使えるか。施工説明書の表は配管長 ${m.pipeTableMax}m まで`);
      if (!S.salt && m.salt && M[m.salt]) add("依頼元", `現場が海の近くなら、塩害仕様（${m.salt}）にするか`);
      // 既設と配管の接続径が違う時
      const om = r.old && r.old !== r.model ? M[r.old] : null;
      if (om && om.pipe && m.pipe && (om.pipe.gas !== m.pipe.gas || om.pipe.liq !== m.pipe.liq)) {
        const d = [];
        if (om.pipe.gas !== m.pipe.gas) d.push(`吸入 φ${om.pipe.gas} → φ${m.pipe.gas}`);
        if (om.pipe.liq !== m.pipe.liq) d.push(`液 φ${om.pipe.liq} → φ${m.pipe.liq}`);
        add("依頼元", `${r.model} は配管の接続径が既設と違います（${d.join("、")}）。異径継手で合わせるか、既設の配管サイズを確かめる`);
      }
    });
    S.olds.forEach((o) => { const c = M[o.model].cu; if (c && c.unknown) add(`${M[o.model].maker}（既設のメーカー）`, `既設 ${o.model} の能力（同等かの裏付け）`); });
    const groups = {};
    list.forEach((c) => { (groups[c.to] = groups[c.to] || []).push(c.text); });
    return groups;
  }

  // ───── 画面 ─────
  function render() {
    save();
    const ol = $("olds");
    ol.innerHTML = S.olds.length ? S.olds.map((o, i) => {
      const m = M[o.model];
      return `<li><div class="who"><b>${esc(o.model)}</b><small>${esc(m.maker)}・${esc(m.kind)}${m.desc ? "・" + esc(m.desc) : ""}</small></div>
        <div class="qty" role="group" aria-label="${esc(o.model)} の台数"><button type="button" data-dec="${i}" aria-label="1台へらす">−</button><output>${o.qty}</output><button type="button" data-inc="${i}" aria-label="1台ふやす">＋</button></div>
        <button class="del" type="button" data-del="${i}" aria-label="${esc(o.model)} を外す">外す</button></li>`;
    }).join("") : `<li class="empty" style="border:0;padding:0">まだ入っていません。上に型式を入れるか、例を押してください。</li>`;

    $("presets").innerHTML = PRESETS.map((p) => `<button type="button" class="chip" data-preset="${p.id}" aria-pressed="${S.preset === p.id}">${esc(p.label)}</button>`).join("");
    if (document.activeElement !== $("troom")) $("troom").value = S.troom;
    if (document.activeElement !== $("pipe")) $("pipe").value = S.pipe;
    $("hz").innerHTML = [50, 60].map((h) => `<button type="button" data-hz="${h}" aria-pressed="${S.hz === h}">${h}Hz</button>`).join("");
    $("salt").innerHTML = [[false, "なし"], [true, "あり"]].map(([v, l]) => `<button type="button" data-salt="${v}" aria-pressed="${S.salt === v}">${l}</button>`).join("");
    const mk = makers();
    $("makerField").hidden = mk.length < 2;
    if (mk.length >= 2 && !mk.includes(S.maker)) S.maker = mk[0];
    $("maker").innerHTML = mk.map((m) => `<button type="button" data-maker="${esc(m)}" aria-pressed="${S.maker === m}">${esc(m)}</button>`).join("");

    const { items, options } = compose();
    const any = items.length > 0;
    ["resultSec", "itemsSec", "capSec", "chkSec"].forEach((id) => { $(id).hidden = !any; });
    if (!any) return;

    // 結論
    const cap = capacity(items);
    const cu = items.find((r) => M[r.model].kind === "冷凍機"), uc = items.find((r) => M[r.model].kind === "クーラー");
    const combo = [cu && `冷凍機 ${cu.model}${cu.qty > 1 ? " ×" + cu.qty : ""}`, uc && `クーラー ${uc.model}${uc.qty > 1 ? " ×" + uc.qty : ""}`].filter(Boolean).join(" ＋ ");
    const vt = { ok: ["ok", "既設と同等以上"], warn: ["warn", "能力に確かめる所あり"], bad: ["bad", "既設を下回る・使えない所あり"] }[cap.verdict];
    const others = items.length - [cu, uc].filter(Boolean).length;
    $("verdict").innerHTML = `<span class="pill ${vt[0]}">${vt[1]}</span>
      <p class="combo">${esc(combo || "（冷凍機・クーラーなし）")}${others ? `<small>＋ 付帯機器 ${others} 点</small>` : ""}</p>
      <p class="note">値段は入っていません。型式をコピーして、価格表で見てください。</p>
      <div class="btns"><button class="btn small" type="button" data-copy="models">型式と数量をコピー</button><button class="btn ghost small" type="button" data-copy="table">表をコピー（Excel 貼り付け用）</button></div>`;

    // 選んだ機器
    $("items").innerHTML = items.map((r) => {
      const m = M[r.model]; const same = r.old === r.model;
      return `<article class="item">
        <div class="item-top"><span class="tag kind">${esc(m.kind)}</span><span class="tag">${esc(m.maker)}</span>${same ? `<span class="tag same">既設と同じ型式</span>` : ""}${m.flag ? `<span class="tag check">${esc(m.flag)}</span>` : ""}<span class="qtyx">×${r.qty}</span></div>
        <button type="button" class="model" data-copytext="${esc(r.model)}">${esc(r.model)}</button>
        ${r.old && !same ? `<p class="from">既設 ${esc(r.old)} から</p>` : ""}
        ${m.desc ? `<p class="desc">${esc(m.desc)}</p>` : ""}
        ${m.pipe ? `<p class="memo">配管接続 吸入 φ${esc(m.pipe.gas)}・液 φ${esc(m.pipe.liq)}${m.size ? `／外形 ${esc(m.size)}（高さ×幅×奥行）` : ""}${m.mass ? `・${esc(m.mass)}` : ""}</p>` : ""}
        ${m.memo ? `<p class="memo">${esc(m.memo)}</p>` : ""}
      </article>`;
    }).join("");
    $("opts").innerHTML = options.map((op) => `<label class="opt"><input type="checkbox" data-opt="${esc(op.m)}" ${S.opts[op.m] ? "checked" : ""}><span>${esc(op.label)}（${esc(op.m)}）</span></label>`).join("");

    // 能力
    $("capCond").textContent = `庫内 ${S.troom}℃・蒸発 ${S.troom - 10}℃・配管 ${S.pipe}m・${S.hz}Hz`;
    $("caps").innerHTML = cap.rows.map((row) => {
      const vals = row.bars.filter((b) => !b.unknown).map((b) => b.max || b.kw);
      const top = Math.max(...vals, 1) * 1.1;
      const pill = { ok: ["ok", "同等以上"], warn: ["warn", "確かめる"], bad: ["bad", "足りない"] }[row.state];
      const bars = row.bars.map((b) => {
        if (b.unknown) return `<div class="bar"><span>${b.who}</span><span class="note">${esc(b.model)}：分かりません</span><b>—</b></div>`;
        const w = (b.kw / top * 100).toFixed(1), wr = b.max ? ((b.max - b.kw) / top * 100).toFixed(1) : 0;
        return `<div class="bar ${b.isNew ? "new" : ""}"><span>${b.who}${b.est ? "（推定）" : ""}</span><div class="track" title="${esc(b.model)}"><div class="fill" style="width:${w}%"></div>${b.max ? `<div class="range" style="width:${wr}%"></div>` : ""}</div><b>${kw(b.kw)}${b.max ? "〜" + kw(b.max) : ""} kW</b></div>`;
      }).join("");
      const conds = row.cond ? [row.cond] : row.bars.filter((b) => b.note).map((b) => `${b.who} ${b.model}：${b.note}`);
      const b1 = row.balance, b2 = row.balanceMax;
      const bal = !b1 ? "" : b2
        ? `<p class="balance">クーラーと合わせると、蒸発 <b>${b1.te.toFixed(1)}〜${b2.te.toFixed(1)}℃</b>（温度差 <b>${b1.td.toFixed(1)}〜${b2.td.toFixed(1)}K</b>）で <b>${kw(b1.kw)}〜${kw(b2.kw)} kW</b> で釣り合います（インバーターの定格側〜最大側）${b1.outside || b2.outside ? "。能力表の外を直線でのばした値を含みます" : ""}。</p>`
        : `<p class="balance">クーラーと合わせると、蒸発 <b>${b1.te.toFixed(1)}℃</b>（温度差 <b>${b1.td.toFixed(1)}K</b>）で <b>${kw(b1.kw)} kW</b> で釣り合います${b1.outside ? "（能力表の外を直線でのばした値）" : ""}。</p>`;
      return `<div class="cap"><h3>${row.title}<span class="pill ${pill[0]}">${pill[1]}</span></h3><div class="bars">${bars}</div>${bal}
        ${row.notes.map((n) => `<p class="why">${esc(n)}</p>`).join("")}
        ${conds.map((c) => `<p class="cond-note">${esc(c)}</p>`).join("")}</div>`;
    }).join("") || `<p class="empty">冷凍機・クーラーが入ると、能力をくらべます。</p>`;

    // 確かめること
    const g = checks(items);
    $("checks").innerHTML = Object.keys(g).map((to) => `<div class="check-group"><h3>${esc(to)}へ</h3><ul>${g[to].map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`).join("") || `<p class="empty">いまは、ありません。</p>`;
  }

  function renderFooter() {
    const count = (mk) => Object.values(M).filter((m) => m.maker === mk).length;
    const src = SEL.makers.map((mk) => {
      const list = SEL.sources[mk] || [];
      return `<li><b>${esc(mk)}</b>（${count(mk)} 型式）${list.length ? "：" + list.map(esc).join("／") : "：まだ入っていません"}</li>`;
    }).join("");
    $("footer").innerHTML = `<p>データ ${esc(SEL.version)} 版（アプリ ${esc(window.APP_VERSION || "")}）。値段・お客さんの名前は入っていません。能力はメーカーの仕様書・能力表の値で、最後はメーカーに確かめてください。</p><ul>${src}</ul>`;
  }

  // ───── コピー ─────
  let toastTimer;
  function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 1600); }
  function copy(text, label) {
    const fallback = () => { $("sheet").hidden = false; const ta = $("sheetText"); ta.value = text; ta.focus(); ta.select(); };
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) return fallback();
      navigator.clipboard.writeText(text).then(() => toast(`${label} をコピーしました`), fallback);
    } catch (e) { fallback(); }
  }
  function tableText() {
    const { items } = compose();
    const rows = items.map((r) => { const m = M[r.model]; return [m.kind, r.old || "—", r.model, r.qty, m.maker, m.memo || ""].join("\t"); });
    return [["区分", "既設", "型式", "数量", "メーカー", "メモ"].join("\t")].concat(rows).join("\n");
  }

  // ───── 操作 ─────
  function addOld(raw) {
    const msg = $("addMsg"); msg.hidden = true;
    const id = norm(raw); if (!id) return false;
    if (SUCC[id] && M[id]) {
      const e = S.olds.find((o) => o.model === id);
      if (e) e.qty++; else S.olds.push({ model: id, qty: 1 });
      S.preset = ""; render(); return true;
    }
    msg.hidden = false;
    const near = Object.keys(SUCC).filter((k) => k.includes(id) || id.includes(k)).slice(0, 3);
    msg.textContent = M[id] ? `${id} は今の機種です。既設の型式を入れてください。`
      : `${id} はまだ入っていません。` + (near.length ? `近い型式：${near.join("・")}` : "型式の打ち間違いが無いか確かめてください。");
    return false;
  }
  function loadPreset(id) {
    const p = PRESETS.find((x) => x.id === id); if (!p) return;
    S.olds = p.olds.map(([model, qty]) => ({ model, qty })); S.troom = p.troom; S.pipe = p.pipe; S.hz = p.hz; S.salt = p.salt; S.maker = p.maker || ""; S.opts = {}; S.preset = id;
    $("addMsg").hidden = true; render();
  }

  $("oldList").innerHTML = Object.keys(SUCC).filter((k) => M[k]).sort().map((k) => `<option value="${esc(k)}">${esc(M[k].maker + "・" + M[k].kind)}</option>`).join("");
  $("addForm").addEventListener("submit", (e) => { e.preventDefault(); if (addOld($("oldInput").value)) { $("oldInput").value = ""; $("oldInput").blur(); } });
  $("troom").addEventListener("input", (e) => { const v = parseFloat(norm(e.target.value)); if (!isNaN(v)) { S.troom = Math.max(-45, Math.min(15, v)); S.preset = ""; render(); } });
  $("pipe").addEventListener("input", (e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) { S.pipe = Math.max(0, Math.min(150, v)); S.preset = ""; render(); } });
  $("sheetClose").addEventListener("click", () => { $("sheet").hidden = true; });
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, input[type=checkbox]"); if (!t) return;
    const d = t.dataset;
    if (d.step) {
      const [key, by] = d.step.split(":"); const lim = key === "troom" ? [-45, 15] : [0, 150];
      S[key] = Math.max(lim[0], Math.min(lim[1], S[key] + Number(by))); S.preset = "";
      $(key).value = S[key]; render();
    }
    else if (d.preset) loadPreset(d.preset);
    else if (d.inc) { S.olds[+d.inc].qty++; render(); }
    else if (d.dec) { const o = S.olds[+d.dec]; if (o.qty > 1) { o.qty--; render(); } }
    else if (d.del) { S.olds.splice(+d.del, 1); S.preset = ""; render(); }
    else if (d.hz) { S.hz = +d.hz; render(); }
    else if (d.salt) { S.salt = d.salt === "true"; render(); }
    else if (d.maker) { S.maker = d.maker; render(); }
    else if (d.opt) { S.opts[d.opt] = t.checked; render(); }
    else if (d.copytext != null) copy(d.copytext, d.copytext);
    else if (d.copy === "models") copy(compose().items.map((r) => `${r.model} ×${r.qty}`).join("\n"), "型式と数量");
    else if (d.copy === "table") copy(tableText(), "表");
  });

  // ホーム画面に置く案内（iPhone の Safari で、まだ置いていない時だけ）
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  let dismissed = false; try { dismissed = localStorage.getItem("install-dismissed") === "1"; } catch (e) {}
  if (isIOS && navigator.standalone === false && !dismissed) $("install").hidden = false;
  $("installClose").addEventListener("click", () => { $("install").hidden = true; try { localStorage.setItem("install-dismissed", "1"); } catch (e) {} });

  renderFooter();
  if (!restore() || !S.olds.length) loadPreset(PRESETS[0] ? PRESETS[0].id : ""); else render();

  // 電波が無くても動くように（公開した置き場の上でだけ。LINE の中のブラウザなど、使えない所では飛ばす）
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker && location.protocol === "https:") {
      const sw = navigator.serviceWorker;
      Promise.resolve().then(() => sw.register("sw.js")).catch(() => {});
      let had = !!sw.controller;
      sw.addEventListener("controllerchange", () => { if (had) toast("新しい版になりました"); had = true; });
    }
  } catch (e) { /* 使えない所では、電波ありの時だけ動く */ }
})();
