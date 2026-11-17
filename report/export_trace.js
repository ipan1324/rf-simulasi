// Membuat report/trace.json dari core.js (seed 12, 3 pohon, m = 2)
const RF = require('../core.js');
const r = RF.runForest({ seed: 12, nTrees: 3, m: 2 });
function strip(n) {
  const o = { id: n.id, branch: n.branch, n: n.n, counts: n.counts, entropy: n.entropy, leaf: n.leaf, rows: n.rows };
  if (n.leaf) { o.label = n.label; o.reason = n.reason; return o; }
  o.candidates = n.candidates.map((c) => ({ name: c.name, feature: c.feature, gain: c.gain, split: c.split, gainRatio: c.gainRatio, gainStr: c.gainStr, splitStr: c.splitStr, grStr: c.grStr,
    values: c.values.map((v) => ({ value: v.value, n: v.n, counts: v.counts, entropy: v.entropy, entropyStr: v.entropyStr, splitTerm: v.splitTerm })) }));
  o.totalStr = n.totalStr; o.feature = n.feature; o.featureName = n.featureName;
  o.children = n.children.map((c) => ({ value: c.value, node: strip(c.node) }));
  return o;
}
const out = { data: r.data, sample: r.sample, votes: r.votes, final: r.final,
  trees: r.trees.map((t) => ({ index: t.index, bootstrap: t.bootstrap, oob: t.oob, root: strip(t.root), pred: t.prediction })) };
require('fs').writeFileSync(__dirname + '/trace.json', JSON.stringify(out, null, 1));
console.log(r.votes, r.final);
