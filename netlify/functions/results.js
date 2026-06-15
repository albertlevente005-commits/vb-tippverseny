// (Nem használt.) A frissítés a GitHub Action -> results.json úton történik,
// a böngésző közvetlenül a results.json statikus fájlt olvassa.
exports.handler = async () => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ note: "Lásd results.json + .github/workflows/refresh.yml" }),
});
