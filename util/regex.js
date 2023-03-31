export function extractRegionalVariantName(pokemonName) {
  return pokemonName?.match(`(?<=-).+$`)?.[0];
}
