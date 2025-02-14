/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable('extension', table => {
    table.increments('id').primary().unique();
    table.string('name').notNullable();
    table.string('version').notNullable();
    table.string('path').notNullable();
    table.json('windows').nullable();
    table.string('icon').nullable();
    table.text('description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(null).nullable();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
  return knex.schema.dropTable('extension');
};
