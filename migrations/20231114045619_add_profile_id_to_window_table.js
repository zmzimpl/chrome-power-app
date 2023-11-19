/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Step 1: Add the profile_id column, allowing NULL
  await knex.schema.table('window', table => {
    table.string('profile_id', 255);
  });

  // Step 2: Update existing rows with a unique profile_id
  const windows = await knex.select('*').from('window');
  for (const window of windows) {
    await knex('window').where({id: window.id}).update({profile_id: generateUniqueProfileId()});
  }

  // Step 3: Alter the column to set it to NOT NULL
  await knex.schema.table('window', table => {
    table.string('profile_id', 255).notNullable().alter();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.table('window', function (table) {
    table.dropColumn('profile_id');
  });
};

function generateUniqueProfileId(length = 7) {
  let result = '';
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}
