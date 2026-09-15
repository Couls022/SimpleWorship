const obj = { a: 1, b: { renderFrame: "massive string", other: 2 } };
const stripped = Object.fromEntries(Object.entries(obj).map(([k, v]) => {
  const { renderFrame, ...rest } = v;
  return [k, rest];
}));
console.log(stripped);
