/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  // Step 1: Add the profile_id column, allowing NULL
  await knex.schema.table('window', table => {
    table.text('fingerprint').nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.table('window', function (table) {
    table.dropColumn('fingerprint');
  });
};
