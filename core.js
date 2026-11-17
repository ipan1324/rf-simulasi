/* Inti algoritma Random Forest (C4.5: Entropy, Gain, Split Info, Gain Ratio)
   Dipakai bersama oleh web simulasi (browser) dan pembuat laporan (Node.js). */
(function (root) {
  'use strict';

  const DEFAULT_DATA = {
    target: 'Meminjam Buku',
    attrs: [
      { name: 'Tugas', values: ['Banyak', 'Sedang', 'Sedikit'] },
      { name: 'Cuaca', values: ['Cerah', 'Hujan'] },
      { name: 'Waktu Luang', values: ['Ada', 'Tidak'] },
      { name: 'Wajib Referensi', values: ['Ya', 'Tidak'] }
    ],
    classes: ['Ya', 'Tidak'],
    rows: [
      ['Sedikit', 'Hujan', 'Tidak', 'Tidak', 'Tidak'],
      ['Sedikit', 'Hujan', 'Ada', 'Tidak', 'Tidak'],
      ['Sedang', 'Hujan', 'Tidak', 'Tidak', 'Tidak'],
      ['Banyak', 'Cerah', 'Ada', 'Tidak', 'Ya'],
      ['Banyak', 'Hujan', 'Tidak', 'Ya', 'Ya'],
      ['Banyak', 'Cerah', 'Ada', 'Ya', 'Ya'],
      ['Sedang', 'Cerah', 'Ada', 'Ya', 'Ya'],
      ['Sedikit', 'Cerah', 'Tidak', 'Tidak', 'Tidak'],
      ['Sedikit', 'Cerah', 'Ada', 'Ya', 'Ya'],
      ['Sedang', 'Cerah', 'Tidak', 'Ya', 'Ya'],
      ['Sedang', 'Hujan', 'Ada', 'Ya', 'Ya'],
      ['Sedang', 'Cerah', 'Ada', 'Tidak', 'Ya'],
      ['Banyak', 'Hujan', 'Ada', 'Tidak', 'Ya'],
      ['Banyak', 'Hujan', 'Tidak', 'Tidak', 'Tidak']
    ]
  };
  const DEFAULT_SAMPLE = ['Sedikit', 'Hujan', 'Ada', 'Ya'];

  /* ---------- utilitas ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fmt(x, d) {
    if (d === undefined) d = 6;
    return (Math.abs(x) < 1e-12 ? 0 : x).toFixed(d).replace('.', ',');
  }
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  function entropyOf(counts) {
    const n = sum(counts); let e = 0;
    counts.forEach((c) => { if (c > 0) { const p = c / n; e -= p * Math.log2(p); } });
    return e;
  }
  function entropyStr(counts) {
    const n = sum(counts);
    const t = counts.map((c) => '(-' + c + '/' + n + ' × log₂(' + c + '/' + n + '))').join(' + ');
    return t + ' = ' + fmt(entropyOf(counts));
  }
  function argmaxFirst(arr) {
    let bi = 0;
    arr.forEach((v, i) => { if (v > arr[bi]) bi = i; });
    return bi;
  }

  /* ---------- membangun satu pohon ---------- */
  function buildTree(data, rowIdx, features, ctx, id, branch) {
    const classes = data.classes;
    const counts = classes.map((c) => rowIdx.filter((i) => data.rows[i][data.attrs.length] === c).length);
    const n = rowIdx.length;
    const node = { id: id, branch: branch, n: n, counts: counts, entropy: entropyOf(counts), rows: rowIdx.slice() };
    const majority = classes[argmaxFirst(counts)];
    ctx.nodes.push(node);

    if (counts.filter((c) => c > 0).length === 1) {
      node.leaf = true; node.label = majority; node.reason = 'Semua data berada pada kelas yang sama';
      return node;
    }
    if (features.length === 0) {
      node.leaf = true; node.label = majority; node.reason = 'Atribut habis, diambil kelas mayoritas';
      return node;
    }

    // pilih m atribut secara acak
    const m = Math.min(ctx.m, features.length);
    const pool = features.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(ctx.rng() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const cand = pool.slice(0, m).sort((a, b) => a - b);
    node.candidates = [];
    cand.forEach((fi) => {
      const a = data.attrs[fi];
      const vals = [];
      a.values.forEach((v) => {
        const sub = rowIdx.filter((i) => data.rows[i][fi] === v);
        if (sub.length === 0) return;
        const c = classes.map((cl) => sub.filter((i) => data.rows[i][data.attrs.length] === cl).length);
        const w = sub.length / n;
        vals.push({
          value: v, n: sub.length, counts: c, entropy: entropyOf(c), entropyStr: entropyStr(c),
          splitTerm: -w * Math.log2(w), idx: sub
        });
      });
      const rem = sum(vals.map((v) => (v.n / n) * v.entropy));
      const gain = node.entropy - rem;
      const split = sum(vals.map((v) => v.splitTerm));
      const gr = split > 1e-12 ? gain / split : 0;
      const gainStr = fmt(node.entropy) + ' − (' + vals.map((v) => '(' + v.n + '/' + n + ' × ' + fmt(v.entropy) + ')').join(' + ') + ') = ' + fmt(gain);
      const splitStr = vals.map((v) => '(-' + v.n + '/' + n + ' × log₂(' + v.n + '/' + n + '))').join(' + ') + ' = ' + fmt(split);
      const grStr = fmt(gain) + ' / ' + fmt(split) + ' = ' + fmt(gr);
      node.candidates.push({ feature: fi, name: a.name, values: vals, gain: gain, split: split, gainRatio: gr, gainStr: gainStr, splitStr: splitStr, grStr: grStr });
    });
    node.totalStr = entropyStr(counts);
    let best = 0;
    node.candidates.forEach((c, i) => { if (c.gainRatio > node.candidates[best].gainRatio + 1e-12) best = i; });
    const chosen = node.candidates[best];
    node.leaf = false; node.feature = chosen.feature; node.featureName = chosen.name; node.majority = majority;
    node.children = chosen.values.map((v, k) =>
      ({ value: v.value, node: buildTree(data, v.idx, features.filter((f) => f !== chosen.feature), ctx, id + '.' + (k + 1), v.value) }));
    return node;
  }

  function predictTree(tree, data, sample) {
    const path = []; let node = tree;
    while (!node.leaf) {
      const v = sample[node.feature];
      path.push({ id: node.id, feature: node.featureName, value: v });
      const ch = node.children.find((c) => c.value === v);
      if (!ch) return { label: node.majority, path: path, fallback: node.id };
      node = ch.node;
    }
    path.push({ id: node.id, leaf: true, label: node.label });
    return { label: node.label, path: path };
  }

  /* ---------- hutan acak ---------- */
  function runForest(opts) {
    const data = opts.data || DEFAULT_DATA;
    const nTrees = opts.nTrees || 3, m = opts.m || 2, seed = opts.seed === undefined ? 1 : opts.seed;
    const sample = opts.sample || DEFAULT_SAMPLE;
    const rng = mulberry32(seed);
    const N = data.rows.length, d = data.attrs.length;
    const trees = [];
    for (let t = 0; t < nTrees; t++) {
      const boot = [];
      for (let i = 0; i < N; i++) boot.push(Math.floor(rng() * N));
      const bootRows = boot.map((i) => i);
      // data bootstrap dipakai sebagai "data latih" pohon; indeks baris = posisi pada hasil bootstrap
      const bdata = { attrs: data.attrs, classes: data.classes, rows: bootRows.map((i) => data.rows[i]) };
      const ctx = { nodes: [], rng: rng, m: m };
      const root = buildTree(bdata, bdata.rows.map((_, i) => i), data.attrs.map((_, i) => i), ctx, '1', null);
      const pred = predictTree(root, bdata, sample);
      const oob = []; for (let i = 0; i < N; i++) if (boot.indexOf(i) < 0) oob.push(i);
      trees.push({ index: t + 1, bootstrap: boot, oob: oob, root: root, nodes: ctx.nodes, prediction: pred });
    }
    const votes = {}; data.classes.forEach((c) => (votes[c] = 0));
    trees.forEach((t) => votes[t.prediction.label]++);
    const vc = data.classes.map((c) => votes[c]);
    const final = data.classes[argmaxFirst(vc)];
    return { params: { nTrees: nTrees, m: m, seed: seed }, data: data, sample: sample, trees: trees, votes: votes, final: final };
  }

  const api = { DEFAULT_DATA: DEFAULT_DATA, DEFAULT_SAMPLE: DEFAULT_SAMPLE, runForest: runForest, fmt: fmt, entropyOf: entropyOf, mulberry32: mulberry32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RF = api;
})(typeof self !== 'undefined' ? self : this);
