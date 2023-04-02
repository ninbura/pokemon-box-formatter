import { readdirSync, rmSync, writeFile } from "fs";
import path from "path";
import Pokedex from "pokedex-promise-v2";
import colosseumData from "../additional-data/colosseum.json" assert { type: "json" };
import xdData from "../additional-data/xd.json" assert { type: "json" };
import formExclusions from "../additional-data/form-exclusions.json" assert { type: "json" };
import compatiblePokemon from "../additional-data/compatible-pokemon.json" assert { type: "json" };
import { root } from "../index.js";

export const pokedex = new Pokedex(),
  collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
  }),
  { results: generationNames } = await pokedex?.getGenerationsList(),
  generations = await Promise.all(
    generationNames?.map(
      async (generationName) =>
        await pokedex?.getGenerationByName(generationName?.name)
    )
  ),
  { results: versionGroupNames } = await pokedex?.getVersionGroupsList(),
  { results: pokemonNames } = await pokedex?.getPokemonsList(),
  _nationalPokedex = await pokedex.getPokedexByName(`national`),
  nationalPokedex = {
    generation: `pokémon home`,
    pokemonPerBox: 30,
    pokemon: _nationalPokedex?.pokemon_entries?.map((entry) => {
      const { pokemon_species: pokemonSpecies, entry_number: entryNumber } =
        entry;

      return {
        name: pokemonSpecies?.name,
        nationalNumber: entryNumber,
      };
    }),
  },
  nationalNumbers = Object.assign(
    ...nationalPokedex?.pokemon?.map((pokemon) => {
      return { [pokemon?.name]: pokemon?.nationalNumber };
    })
  );

export async function getSideVersions() {
  const versionGroups = await Promise.all(
      versionGroupNames.map(async (versionGroupName) =>
        pokedex.getVersionGroupByName(versionGroupName?.name)
      )
    ),
    sideVersions = [
      `lets-go-pikachu-lets-go-eevee`,
      `legends-arceus`,
      `the-teal-mask`,
      `the-indigo-disk`,
    ];

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

export function getOldPokedexes(generations, sideVersions) {
  const oldPokedexes = [],
    exceptionalVersionsArray = [[`stadium`], [`stadium-2`]];

  for (let index = 0; index < 7; index++) {
    const generation = generations[index],
      { pokemon_species: pokemonSpecies } = generation,
      applicableVersions = getApplicableVersions(generation, sideVersions),
      exceptionalVersions = exceptionalVersionsArray[index];

    if (exceptionalVersions?.length > 0)
      applicableVersions.push(...exceptionalVersions);

    const generationNumber = index + 1,
      applicableVersionString = applicableVersions.join(`, `),
      previousPokedex = oldPokedexes[index - 1]?.pokemon,
      nationalPokemon = previousPokedex ? previousPokedex : [],
      previousPokedexLength = nationalPokemon.length;

    oldPokedexes.push({
      generation: `generation ${generationNumber} (${applicableVersionString})`,
      pokemonPerBox: index <= 1 ? 20 : 30,
      pokemon: [],
    });

    pokemonSpecies.sort((a, b) => collator.compare(a?.url, b?.url));

    const generationSpecificPokemon = pokemonSpecies.map(
      (pokemonSpecimen, jndex) => {
        return {
          name: pokemonSpecimen?.name,
          nationalNumber: previousPokedexLength + jndex + 1,
        };
      }
    );

    oldPokedexes[index]?.pokemon.push(
      ...nationalPokemon,
      ...generationSpecificPokemon
    );
  }

  return oldPokedexes;
}

export function getCompatiblePokemon() {
  const _compatiblePokemon = compatiblePokemon.map((version) => {
    const { versionName, compatiblePokemon } = version,
      pokemonSpecies = compatiblePokemon?.map(
        (pokemonNumber) =>
          _nationalPokedex?.pokemon_entries?.[pokemonNumber - 1]
            ?.pokemon_species
      );

    return { versionName: versionName, pokemonSpecies: pokemonSpecies };
  });

  return _compatiblePokemon;
}

function getPokemonNumber(url) {
  const urlSet = new Set(url.split(`/`)),
    urlArray = [...urlSet],
    pokemonNumber = urlArray.pop();

  return pokemonNumber;
}

export async function getNewPokedexes(
  generations,
  sideVersions,
  compatiblePokemon
) {
  const newPokedexes = [];

  for (let index = 7; index < generations.length; index++) {
    const generation = generations[index],
      region = generation?.main_region?.name,
      regionPokedex = await pokedex.getPokedexByName(region),
      pokemonSpecies = regionPokedex?.pokemon_entries.map(
        (entry) => entry?.pokemon_species
      ),
      generationNumber = index + 1,
      applicableVersions = getApplicableVersions(generation, sideVersions),
      applicableVersionString = applicableVersions.join(`, `);

    compatiblePokemon.forEach((version) => {
      const { versionName, pokemonSpecies: _pokemonSpecies } = version;

      if (applicableVersionString.match(versionName))
        pokemonSpecies.push(..._pokemonSpecies);
    });

    pokemonSpecies.sort((a, b) => collator.compare(a?.url, b?.url));

    newPokedexes.push({
      generation: `generation ${generationNumber} (${applicableVersionString})`,
      pokemonPerBox: 30,
    });

    newPokedexes[index - 7].pokemon = pokemonSpecies.map((specimen) => {
      return {
        name: specimen?.name,
        nationalNumber: getPokemonNumber(specimen?.url),
      };
    });
  }

  return newPokedexes;
}

function generatePokemonDisplayText(pokemon) {
  const { name, nationalNumber } = pokemon;
  let pokemonDisplayText;

  if (Array.isArray(name)) {
    const displayArray = name.map(
      (_name, index) => `${_name} (#${nationalNumber[index]})`
    );

    pokemonDisplayText = displayArray.join(` / `);
  } else {
    pokemonDisplayText = `${pokemon?.name} (#${nationalNumber})`;
  }

  return pokemonDisplayText;
}

function constructCustomPokedex(
  nationalPokedex,
  additionalData,
  generationName
) {
  const additionalPokedex = {
    generation: generationName,
    pokemonPerBox: 30,
    pokemon: additionalData.map((nationalNumbers) => {
      const pokemonArray = nationalNumbers.map(
        (nationalNumber) => nationalPokedex?.pokemon[nationalNumber - 1]?.name
      );

      return { name: pokemonArray, nationalNumber: nationalNumbers };
    }),
  };

  return additionalPokedex;
}

function constructPokemonBox(oldPokedexes) {
  const genThreePokedex = oldPokedexes.find((pokedex) =>
      pokedex?.generation?.match(`emerald`)
    ),
    genThreePokedexCopy = JSON.parse(JSON.stringify(genThreePokedex));

  genThreePokedexCopy.generation = `generation 3.3 (pokémon-box)`;
  genThreePokedexCopy.pokemonPerBox = 60;

  return genThreePokedexCopy;
}

function constructPokemonRanch(oldPokedexes) {
  const genFourPokedex = oldPokedexes.find((pokedex) =>
      pokedex?.generation?.match(`diamond-pearl`)
    ),
    genFourPokedexCopy = JSON.parse(JSON.stringify(genFourPokedex));

  genFourPokedexCopy.generation = `generation 4.1 (pokémon-ranch)`;
  genFourPokedexCopy.pokemonPerBox = 1000;

  return genFourPokedexCopy;
}

async function constructAdditionalPokedex(
  region,
  generationName,
  pokemonPerBox = 30,
  boxName = `box`
) {
  const existingPokedex = await pokedex.getPokedexByName(region),
    pokemonSpecies = existingPokedex?.pokemon_entries.map(
      (entry) => entry?.pokemon_species
    ),
    additionalPokedex = {
      generation: generationName,
      pokemonPerBox: pokemonPerBox,
      boxName: boxName,
    };
  pokemonSpecies.sort((a, b) => collator.compare(a?.url, b?.url));

  additionalPokedex.pokemon = pokemonSpecies.map((specimen) => {
    return {
      name: specimen?.name,
      nationalNumber: getPokemonNumber(specimen?.url) * 1,
    };
  });

  return additionalPokedex;
}

export async function generateAdditionalPokedexes(oldPokedexes) {
  const colosseumPokedex = constructCustomPokedex(
      nationalPokedex,
      colosseumData,
      `generation 3.1 (colosseum)`
    ),
    xdPokedex = constructCustomPokedex(
      nationalPokedex,
      xdData,
      `generation 3.2 (xd-gale-of-darkness)`
    ),
    pokemonBoxPokedex = constructPokemonBox(oldPokedexes),
    pokemonRanchPokedex = constructPokemonRanch(oldPokedexes),
    letsGoPokedex = await constructAdditionalPokedex(
      `letsgo-kanto`,
      `generation 7.1 (lets-go-pikachu-lets-go-eevee)`,
      1000
    ),
    legendsArceusPokedex = await constructAdditionalPokedex(
      `hisui`,
      `generation 8.1 (legends-arceus)`,
      30,
      `pasture`
    ),
    additionalPokedexes = {
      colosseum: colosseumPokedex,
      xd: xdPokedex,
      pokemonBox: pokemonBoxPokedex,
      pokemonRanch: pokemonRanchPokedex,
      letsGo: letsGoPokedex,
      legendsArceus: legendsArceusPokedex,
    };

  return additionalPokedexes;
}

//generation can be partial name
function getGenerationSplicePosition(pokedexes, generation) {
  const [desiredPokedex] = Object.entries(pokedexes).find(
    ([index, pokedex]) => {
      return pokedex?.generation?.match(generation);
    }
  );

  return parseInt(desiredPokedex) + 1;
}

export function reorganizePokedexes(pokedexes, additionalPokedexes) {
  const {
      colosseum: colosseumPokedex,
      xd: xdPokedex,
      pokemonBox: pokemonBoxPokedex,
      pokemonRanch: pokemonRanchPokedex,
      letsGo: letsGoPokedex,
      legendsArceus: legendsArceusPokedex,
    } = additionalPokedexes,
    generationThreeIndex = getGenerationSplicePosition(pokedexes, `emerald`);

  pokedexes.splice(generationThreeIndex, 0, ...[colosseumPokedex, xdPokedex]);

  const xdIndex = getGenerationSplicePosition(pokedexes, `xd-gale`);

  pokedexes.splice(xdIndex, 0, pokemonBoxPokedex);

  const generationFourIndex = getGenerationSplicePosition(
    pokedexes,
    `diamond-pearl`
  );

  pokedexes.splice(generationFourIndex, 0, pokemonRanchPokedex);

  const generationSevenIndex = getGenerationSplicePosition(
    pokedexes,
    `sun-moon`
  );

  pokedexes.splice(generationSevenIndex, 0, letsGoPokedex);

  const generationEightIndex = getGenerationSplicePosition(pokedexes, `sword`);

  pokedexes.splice(generationEightIndex, 0, legendsArceusPokedex);

  return pokedexes;
}

export async function getVariants() {
  const standardPokemon = nationalPokedex?.pokemon?.map(
      (pokemon) => pokemon?.name
    ),
    { forms: excludedForms, pokemon: excludedPokemon } = formExclusions;

  let { results: formsList } = await pokedex?.getPokemonFormsList();

  formsList = formsList?.filter((form) => {
    const { name } = form;

    return !standardPokemon?.includes(name) && !excludedForms.includes(name);
  });

  let variants = await Promise.all(
    formsList?.map(
      async (form) => await pokedex?.getPokemonFormByName(form?.name)
    )
  );

  variants = variants.filter((variant) => {
    const { is_battle_only, is_mega, pokemon } = variant;

    return (
      !is_battle_only && !is_mega && !excludedPokemon.includes(pokemon?.name)
    );
  });

  variants = variants.map((variant) => {
    const { id, name, version_group, pokemon } = variant,
      pokemonName = standardPokemon.find((_pokemon) =>
        pokemon?.name.match(_pokemon)
      ),
      nationalNumber = nationalNumbers[pokemonName];

    return {
      id: id,
      name: name,
      pokemonName: pokemonName,
      nationalNumber: nationalNumber,
      versionGroup: version_group?.name,
    };
  });

  variants.sort((a, b) => {
    const aSort = `${a?.nationalNumber} ${a.id} ${a?.name}`,
      bSort = `${b?.nationalNumber} ${b.id} ${b?.name}`;

    return collator.compare(aSort, bSort);
  });

  generations.forEach((generation) => {
    const { id, version_groups } = generation,
      versionGroups = version_groups.map(
        (version_group) => version_group?.name
      );

    for (const variant of variants) {
      if (versionGroups.includes(variant.versionGroup))
        variant.generationNumber = id;
    }
  });

  return variants;
}

export function injectVariants(pokedexes, variants) {
  const variantObject = {};

  variants.forEach((variant) => {
    const { id, name, nationalNumber, versionGroup } = variant;

    pokedexes.forEach((_pokedex, index) => {
      if (_pokedex.generation.match(versionGroup)) {
        if (!variantObject?.[index]) {
          variantObject[index] = [
            { id: id, name: name, nationalNumber: nationalNumber },
          ];
        } else {
          variantObject[index].push({
            id: id,
            name: name,
            nationalNumber: nationalNumber,
          });
        }
      }
    });
  });

  const exceptions = [`colosseum`, `xd-gale`];

  for (const [index, _pokedex] of pokedexes.entries()) {
    const { pokemon: standardPokemon } = _pokedex;

    if (exceptions.find((exception) => _pokedex?.generation.match(exception))) {
      _pokedex.pokemon = {
        standard: standardPokemon,
        variant: [],
      };

      continue;
    }

    let _variants = [];

    for (let jndex = index; jndex >= 0; jndex--) {
      const kndex = Object.keys(variantObject)[jndex];

      if (index >= kndex) {
        _variants.push(...variantObject[kndex]);
      }
    }

    const standardPokemonNumbers = standardPokemon?.map(
      (pokemon) => pokemon?.nationalNumber
    );

    _variants = _variants.filter((variant) =>
      standardPokemonNumbers.includes(variant?.nationalNumber)
    );

    _variants.sort((a, b) => {
      const aSort = `${a?.nationalNumber} ${a.id} ${a?.name}`,
        bSort = `${b?.nationalNumber} ${b.id} ${b?.name}`;

      return collator.compare(aSort, bSort);
    });

    _pokedex.pokemon = {
      standard: standardPokemon,
      variant: _variants,
    };
  }

  return pokedexes;
}

export function countPokemon(pokedexes) {
  for (const pokedex of pokedexes) {
    const pokemonCount = pokedex?.pokemon?.standard.length;

    pokedex.generation += ` [${pokemonCount} pokémon]`;
  }

  return pokedexes;
}

export function generateFileContents(generationalPokedexes) {
  const fileContents = [];

  generationalPokedexes.forEach((pokedex, index) => {
    let boxName = pokedex?.boxName,
      currentBox = 1,
      currentBoxPosition = 1;

    boxName = boxName ? boxName : `box`;

    fileContents.push({
      title: pokedex?.generation,
      content: [],
    });

    [`standard`, `variant`].forEach((type) => {
      const { generation, pokemonPerBox, pokemon } = pokedex;

      pokemon?.[type]?.forEach((_pokemon, jndex) => {
        if (jndex === 0 || jndex % pokemonPerBox === 0) {
          const exceptionalCondition =
            !generation.match(`lets-go-pikachu`) &&
            !generation.match(`pokémon-ranch`) &&
            !generation.match(`gold-silver`);

          if (exceptionalCondition || type === `standard`)
            fileContents[index].content.push(`- [ ] ${boxName} ${currentBox}`);

          if (exceptionalCondition) {
            currentBox++;
            currentBoxPosition = 1;
          }
        }

        const pokemonDisplayText = generatePokemonDisplayText(_pokemon);

        fileContents[index].content.push(
          `    - [ ] ${currentBoxPosition} - ${pokemonDisplayText}`
        );

        currentBoxPosition++;
      });
    });
  });

  return fileContents;
}

export function deleteExistingMarkdownFiles() {
  const directory = `${root}/~markdown-files-here~`;

  readdirSync(directory).forEach((file) => rmSync(`${directory}/${file}`));
}

export function generateMarkdownFiles(fileContents) {
  fileContents.forEach((fileContent) => {
    const { title, content } = fileContent;

    writeFile(
      `${root}/~markdown-files-here~/${title}.md`,
      content.join(`\n`),
      (error) => {
        if (error) {
          console.error(error);
        }
      }
    );
  });
}
