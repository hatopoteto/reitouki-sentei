// パナソニックの、手で入れる分（クーラー・付帯機器と、冷凍機の補足）。冷凍機の型式と能力は panasonic-reitouki.js
// クーラーの能力 uc.td=[[温度差,kW],...]（50Hz）、uc.td60（60Hz）
SEL.add({
  maker: "パナソニック",
  sources: [
    "CC-D6020LH 仕様書（P05）、CC-D6000HD／CC-D6000D の組合せ表、OCU-KS600VFS 施工説明書",
    "不二工機「容量変化表 R448A 用 FWE 形」"
  ],
  extend: {
    "OCU-KS600VFS": {
      memo: "配管接続は OCU-NS600FS と同じ",
      pipeTableMax: 50,
      addons: [{ m: "SEC-C230TA" }, { m: "SPK-RF900" }],
      options: [{ m: "SECT-SW21AL", label: "監禁警報スイッチを付ける" }],
      checks: [
        { to: "依頼元", text: "既設の配管サイズ（吸入・液）と高低差。クーラーが上なら 8m 以内、下なら 20m 以内" },
        { to: "依頼元", text: "冷凍機の電源。漏電遮断器 75A・動力線 14mm²（20m 以内）の指定。既設の遮断器と配線で足りるか" }
      ]
    }
  },
  models: {
    "CC-D6020LH": { kind: "クーラー", desc: "D（大型強冷タイプ）冷凍用・-10℃以下〜-40℃・フィンピッチ 10mm・R448A 等に対応", memo: "霜取ヒーター 4.4kW。適用冷凍機の目安 3.7〜5.5kW",
      uc: { td: [[10, 7.07]] },
      addons: [{ m: "CC-D6000HD", per: "unit" }, { m: "CC-D6000D", per: "unit" }, { m: "FWE-4034TW", per: "unit" }, { m: "BMS-TF4200", per: "unit" }] },
    "CC-D6000HD": { kind: "吸込みフード", memo: "CC-D6020LH に1台（パナの組合せ表どおり）" },
    "CC-D6000D": { kind: "吹出しダンパー", memo: "CC-D6020LH に1台。受注生産品" },
    "SECT-C2300": { kind: "コントローラー", old: true, desc: "マイコンコントローラー（旧型）" },
    "SEC-C230TA": { kind: "コントローラー", desc: "マイコンコントローラー・HFC 専用・0.1℃単位", memo: "KS600VFS の施工説明書が指定する別売部品（クーラー霜取用）" },
    "SPK-RF900": { kind: "フィルター", desc: "フレッシュアップフィルター（配管を流用する時）", memo: "6馬力が RF900 か RF910 かは未確認", flag: "要確認" },
    "SECT-SW21AL": { kind: "警報", desc: "監禁警報スイッチ" },
    "FWE-4034TW": { maker: "不二工機", kind: "膨張弁", desc: "R448A／R449A／R407H 共用・外均", memo: "蒸発 -30℃・凝縮 38℃で 8.33kW。冷凍機の最大能力を1台で受ける" },
    "BMS-TF4200": { maker: "不二工機", kind: "電磁弁", desc: "液管電磁弁・フレア・AC200V", memo: "液管 φ12.7 に合わせた。コントローラーの電磁弁出力で開閉" }
  },
  succ: {
    "CC-D6020LH": ["CC-D6020LH"],
    "SECT-C2300": ["SEC-C230TA"]
  }
});
