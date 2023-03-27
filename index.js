import Pokedex from "pokedex-promise-v2";

const pokedex = new Pokedex();

async function getGenerations() {
  const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    }),
    { results: generationNames } = await pokedex.getGenerationsList(),
    generations = await Promise.all(
      generationNames.map(async (generationName) =>
        pokedex.getGenerationByName(generationName?.name)
      )
    );

  return generations;
}

async function getSideGames() {
  const { results: versionGroupNames } = await pokedex.getVersionGroupsList(),
    versionGroups = await Promise.all(
      versionGroupNames.map(async (versionGroupName) =>
        pokedex.getVersionGroupByName(versionGroupName?.name)
      )
    ),
    sideGames = [];

  versionGroups.forEach((versionGroup) => {
    if (versionGroup?.pokedexes?.length === 0)
      sideGames.push(versionGroup.name);
  });

  return sideGames;
}

const generations = await getGenerations(),
  sideGames = await getSideGames();

console.log(generations[0]?.pokemon_species.length);
