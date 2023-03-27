import fs from "fs";
import Pokedex from "pokedex-promise-v2";

const pokedex = new Pokedex(),
  collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  });

async function getGenerations() {
  const { results: generationNames } = await pokedex.getGenerationsList(),
    generations = [];

  for (const [index, generationName] of generationNames.entries()) {
    if (index > 6) break;

    generations.push(await pokedex.getGenerationByName(generationName?.name));
  }

  return generations;
}

async function getSideVersions() {
  const { results: versionGroupNames } = await pokedex.getVersionGroupsList(),
    versionGroups = await Promise.all(
      versionGroupNames.map(async (versionGroupName) =>
        pokedex.getVersionGroupByName(versionGroupName?.name)
      )
    ),
    sideVersions = [`lets-go-pikachu-lets-go-eevee`];

  versionGroups.forEach((versionGroup) => {
    if (versionGroup?.pokedexes?.length === 0)
      sideVersions.push(versionGroup.name);
  });

  return sideVersions;
}

function getApplicableVersions(generation, sideVersions) {
  const applicableVersions = [];

  generation?.version_groups.forEach((versionGroup) => {
    const { name: versionGroupName } = versionGroup;

    if (!sideVersions.includes(versionGroupName))
      applicableVersions.push(versionGroupName);
  });

  return applicableVersions;
}

function createGenerationalPokedexes(generations, sideVersions) {
  const pokedexes = [];

  generations.forEach((generation, index) => {
    const applicableVersions = getApplicableVersions(generation, sideVersions);

    pokedexes.push({
      generation: `generation ${index + 1} (${applicableVersions.join(`, `)})`,
      pokemonPerBox: index <= 1 ? 20 : 30,
      pokemon: [],
    });

    const pokemonSpecies = generation.pokemon_species;

    pokemonSpecies.sort((a, b) => collator.compare(a?.url, b?.url));

    const previousPokedex = pokedexes[index - 1]?.pokemon,
      nationalPokemon = previousPokedex ? previousPokedex : [],
      generationSpecificPokemon = pokemonSpecies.map(
        (pokemonSpecimen) => pokemonSpecimen?.name
      );

    pokedexes[index]?.pokemon.push(
      ...nationalPokemon,
      ...generationSpecificPokemon
    );
  });

  return pokedexes;
}

function generateFileContents(generationalPokedexes) {
  const fileContents = [];

  generationalPokedexes.forEach((pokedex) => {
    let currentBox = 1,
      currentBoxPosition = 1;

    fileContents.push(`- ${pokedex?.generation}`);

    pokedex?.pokemon.forEach((pokemon, index) => {
      const pokemonNumber = index + 1;

      if (
        pokemonNumber === 1 ||
        (pokemonNumber - 1) % pokedex?.pokemonPerBox === 0
      ) {
        fileContents.push(` - box ${currentBox}`);

        currentBox++;
        currentBoxPosition = 1;
      }

      fileContents.push(
        `   ${currentBoxPosition}. ${pokemon} (#${pokemonNumber})`
      );

      currentBoxPosition++;
    });
  });

  return fileContents;
}

const generations = await getGenerations(),
  sideVersions = await getSideVersions(),
  generationalPokedexes = createGenerationalPokedexes(
    generations,
    sideVersions
  ),
  fileContentArray = generateFileContents(generationalPokedexes);

fs.writeFile(`pokémon box order.md`, fileContentArray.join(`\n`), (error) => {
  if (error) {
    console.error(error);
  }
});
